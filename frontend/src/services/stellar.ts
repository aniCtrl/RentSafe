import { 
  rpc, 
  TransactionBuilder, 
  Contract, 
  Account, 
  nativeToScVal, 
  scValToNative,
  xdr,
  Networks,
  Address
} from '@stellar/stellar-sdk';
import type { StellarWalletsKit as StellarWalletsKitType } from '@creit.tech/stellar-wallets-kit';
import type { Networks as SWKNetworksType } from '@creit.tech/stellar-wallets-kit/types';
import type { defaultModules as defaultModulesType } from '@creit.tech/stellar-wallets-kit/modules/utils';
import contractsConfig from '../contracts-config.json';

// Dummy account for read-only simulations
const DUMMY_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

export interface RentalAgreementData {
  id: number;
  tenant: string;
  landlord: string;
  amount: number;
  state: number; // 0 = PendingDeposit, 1 = Active, 2 = RefundProposed, 3 = Disputed, 4 = Settled
  refundTenantAmount: number;
  refundLandlordAmount: number;
}

export interface DisputeData {
  id: number;
  agreementId: number;
  tenant: string;
  landlord: string;
  amount: number;
  reason: string;
  state: number; // 0 = Open, 1 = Resolved
}

export interface SorobanEventData {
  id: string;
  type: string; // "agreement_created" | "deposit_locked" | "deduction_proposed" | "deduction_approved" | "dispute_raised" | "dispute_resolved" | "dispute_registered"
  agreementId: number;
  ledger: number;
  timestamp: number;
  details: any;
}

export class StellarService {
  private network: 'testnet' | 'local';
  private config: typeof contractsConfig['testnet'];
  private server: rpc.Server;

  constructor(network: 'testnet' | 'local' = 'testnet') {
    this.network = network;
    this.config = { ...contractsConfig[network] };

    if (typeof window !== 'undefined') {
      const escrow = localStorage.getItem(`rentsafe_${network}_escrow`);
      const dispute = localStorage.getItem(`rentsafe_${network}_dispute`);
      const token = localStorage.getItem(`rentsafe_${network}_token`);
      const rpcUrl = localStorage.getItem(`rentsafe_${network}_rpc`);

      if (escrow) this.config.escrow = escrow;
      if (dispute) this.config.dispute = dispute;
      if (token) this.config.token = token;
      if (rpcUrl) this.config.rpcUrl = rpcUrl;
    }

    this.server = new rpc.Server(this.config.rpcUrl);
  }


  // Get current contract configurations
  getConfig() {
    return this.config;
  }

  // ----------------------------------------------------
  // Read-Only Queries (via simulation)
  // ----------------------------------------------------

  async getAgreement(id: number): Promise<RentalAgreementData> {
    try {
      const res = await this.simulateCall(
        this.config.escrow,
        'get_agreement',
        [nativeToScVal(BigInt(id))]
      );
      if (!res) throw new Error('No result returned');

      // The returned value is a RentalAgreement struct
      const val = scValToNative(res);
      return {
        id: Number(val.id),
        tenant: val.tenant.toString(),
        landlord: val.landlord.toString(),
        amount: Number(val.amount) / 10000000, // convert stroops to XLM
        state: Number(val.state),
        refundTenantAmount: Number(val.refund_tenant_amount) / 10000000,
        refundLandlordAmount: Number(val.refund_landlord_amount) / 10000000,
      };
    } catch (err) {
      console.error('getAgreement error:', err);
      throw err;
    }
  }

  async getAgreementCount(): Promise<number> {
    try {
      const res = await this.simulateCall(this.config.escrow, 'get_agreement_count', []);
      if (!res) return 0;
      return Number(scValToNative(res));
    } catch (err) {
      console.error('getAgreementCount error:', err);
      return 0;
    }
  }

  async getDispute(id: number): Promise<DisputeData> {
    try {
      const res = await this.simulateCall(
        this.config.dispute,
        'get_dispute',
        [nativeToScVal(BigInt(id))]
      );
      if (!res) throw new Error('No result returned');
      const val = scValToNative(res);
      return {
        id: Number(val.id),
        agreementId: Number(val.agreement_id),
        tenant: val.tenant.toString(),
        landlord: val.landlord.toString(),
        amount: Number(val.amount) / 10000000,
        reason: val.reason.toString(),
        state: Number(val.state),
      };
    } catch (err) {
      console.error('getDispute error:', err);
      throw err;
    }
  }

  async getDisputeCount(): Promise<number> {
    try {
      const res = await this.simulateCall(this.config.dispute, 'get_dispute_count', []);
      if (!res) return 0;
      return Number(scValToNative(res));
    } catch (err) {
      console.error('getDisputeCount error:', err);
      return 0;
    }
  }

  // Helper to execute simulations (read-only views)
  private async simulateCall(
    contractAddress: string,
    method: string,
    args: xdr.ScVal[]
  ): Promise<xdr.ScVal | undefined> {
    const contract = new Contract(contractAddress);
    const op = contract.call(method, ...args);

    const tx = new TransactionBuilder(
      new Account(DUMMY_ADDRESS, '0'),
      { fee: '100', networkPassphrase: this.config.networkPassphrase }
    )
      .addOperation(op)
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation failed: ${sim.error}`);
    }

    return sim.result?.retval;
  }

  // ----------------------------------------------------
  // State-Modifying Invocations (requires signature)
  // ----------------------------------------------------

  async executeContractCall(
    contractAddress: string,
    method: string,
    args: xdr.ScVal[],
    userAddress: string,
    walletId: string
  ): Promise<string> {
    const contract = new Contract(contractAddress);
    const op = contract.call(method, ...args);

    // 1. Load user account sequence number
    const ledgerAccount = await this.server.getAccount(userAddress);
    const sequence = ledgerAccount.sequenceNumber();
    const source = new Account(userAddress, sequence);

    // 2. Build preliminary transaction
    let tx = new TransactionBuilder(
      source,
      { fee: '100', networkPassphrase: this.config.networkPassphrase }
    )
      .addOperation(op)
      .setTimeout(120)
      .build();

    // 3. Prepare transaction (simulates, updates footprint/resources, automatically adjusts fee)
    tx = await this.server.prepareTransaction(tx);

    // 4. Sign transaction via the user's wallet
    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
    const { Networks: SWKNetworks } = await import('@creit.tech/stellar-wallets-kit/types');
    const { defaultModules } = await import('@creit.tech/stellar-wallets-kit/modules/utils');

    StellarWalletsKit.init({
      network: this.network === 'testnet' ? SWKNetworks.TESTNET : SWKNetworks.STANDALONE,
      modules: defaultModules(),
    });
    StellarWalletsKit.setWallet(walletId);

    const { signedTxXdr } = await StellarWalletsKit.signTransaction(tx.toXDR(), {
      address: userAddress,
      networkPassphrase: this.config.networkPassphrase,
    });

    const signedTx = TransactionBuilder.fromXDR(signedTxXdr, this.config.networkPassphrase);

    // 5. Submit to Stellar network
    const submission = await this.server.sendTransaction(signedTx);
    if (submission.status === 'ERROR') {
      throw new Error(`Submission failed: ${JSON.stringify(submission.errorResult)}`);
    }

    const txHash = submission.hash;

    // 6. Poll status until completion
    let getTxResponse = null;
    for (let i = 0; i < 30; i++) {
      getTxResponse = await this.server.getTransaction(txHash);
      if (getTxResponse.status === 'SUCCESS') {
        return txHash;
      }
      if (getTxResponse.status === 'FAILED') {
        throw new Error(`Transaction execution failed on-chain: ${JSON.stringify(getTxResponse.resultXdr)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Transaction timed out during status polling');
  }

  // ----------------------------------------------------
  // Specific Escrow Workflows
  // ----------------------------------------------------

  async createAgreement(
    tenant: string,
    landlord: string,
    amountXlm: number,
    userAddress: string,
    walletId: string
  ): Promise<string> {
    const stroops = BigInt(Math.floor(amountXlm * 10000000));
    const args = [
      Address.fromString(tenant).toScVal(),
      Address.fromString(landlord).toScVal(),
      nativeToScVal(stroops),
    ];
    return this.executeContractCall(this.config.escrow, 'create_agreement', args, userAddress, walletId);
  }

  async depositEscrow(
    agreementId: number,
    userAddress: string,
    walletId: string
  ): Promise<string> {
    const args = [nativeToScVal(BigInt(agreementId))];
    return this.executeContractCall(this.config.escrow, 'deposit', args, userAddress, walletId);
  }

  async proposeDeduction(
    agreementId: number,
    landlordAmountXlm: number,
    tenantAmountXlm: number,
    userAddress: string,
    walletId: string
  ): Promise<string> {
    const landlordStroops = BigInt(Math.floor(landlordAmountXlm * 10000000));
    const tenantStroops = BigInt(Math.floor(tenantAmountXlm * 10000000));
    const args = [
      nativeToScVal(BigInt(agreementId)),
      nativeToScVal(landlordStroops),
      nativeToScVal(tenantStroops),
    ];
    return this.executeContractCall(this.config.escrow, 'propose_deduction', args, userAddress, walletId);
  }

  async approveDeduction(
    agreementId: number,
    userAddress: string,
    walletId: string
  ): Promise<string> {
    const args = [nativeToScVal(BigInt(agreementId))];
    return this.executeContractCall(this.config.escrow, 'approve_deduction', args, userAddress, walletId);
  }

  async raiseDispute(
    agreementId: number,
    disputer: string,
    reason: string,
    userAddress: string,
    walletId: string
  ): Promise<string> {
    const args = [
      nativeToScVal(BigInt(agreementId)),
      Address.fromString(disputer).toScVal(),
      nativeToScVal(reason),
    ];
    return this.executeContractCall(this.config.escrow, 'raise_dispute', args, userAddress, walletId);
  }

  async resolveDispute(
    disputeId: number,
    landlordAmountXlm: number,
    tenantAmountXlm: number,
    userAddress: string,
    walletId: string
  ): Promise<string> {
    const landlordStroops = BigInt(Math.floor(landlordAmountXlm * 10000000));
    const tenantStroops = BigInt(Math.floor(tenantAmountXlm * 10000000));
    const args = [
      nativeToScVal(BigInt(disputeId)),
      nativeToScVal(landlordStroops),
      nativeToScVal(tenantStroops),
    ];
    return this.executeContractCall(this.config.dispute, 'resolve_dispute', args, userAddress, walletId);
  }

  // ----------------------------------------------------
  // Event Indexing
  // ----------------------------------------------------

  async getEvents(startLedger: number): Promise<SorobanEventData[]> {
    try {
      const response = await this.server.getEvents({
        startLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [this.config.escrow, this.config.dispute],
          },
        ],
        limit: 100,
      });

      return response.events.map((event) => {
        // Parse topics and value
        const topics = event.topic.map((t) => scValToNative(t));
        const value = scValToNative(event.value);
        const type = topics[0]?.toString() || 'unknown';
        const agreementId = Number(topics[1] || 0);

        let details = {};
        if (type === 'agreement_created') {
          details = {
            tenant: value[0]?.toString(),
            landlord: value[1]?.toString(),
            amount: Number(value[2] || 0) / 10000000,
          };
        } else if (type === 'deposit_locked') {
          details = {
            tenant: value[0]?.toString(),
            amount: Number(value[1] || 0) / 10000000,
          };
        } else if (type === 'deduction_proposed') {
          details = {
            tenantAmount: Number(value[0] || 0) / 10000000,
            landlordAmount: Number(value[1] || 0) / 10000000,
          };
        } else if (type === 'deduction_approved' || type === 'dispute_resolved') {
          details = {
            tenantAmount: Number(value[0] || 0) / 10000000,
            landlordAmount: Number(value[1] || 0) / 10000000,
          };
        } else if (type === 'dispute_raised') {
          details = {
            disputeId: Number(value[0] || 0),
            reason: value[1]?.toString(),
          };
        } else if (type === 'dispute_registered') {
          details = {
            agreementId: Number(value[0] || 0),
            amount: Number(value[1] || 0) / 10000000,
            reason: value[2]?.toString(),
          };
        } else if (type === 'dispute_resolved_admin') {
          details = {
            disputeId: agreementId, // topics[1] acts as disputeId for dispute contract events
            tenantAmount: Number(value[0] || 0) / 10000000,
            landlordAmount: Number(value[1] || 0) / 10000000,
          };
        }

        return {
          id: event.id,
          type,
          agreementId: type === 'dispute_resolved_admin' ? Number(details.hasOwnProperty('agreementId') ? (details as any).agreementId : 0) : agreementId,
          ledger: event.ledger,
          timestamp: Date.now(), // RPC doesn't output block timestamp directly in getEvents, we default to indexing time
          details,
        };
      });
    } catch (err) {
      console.warn('Failed to fetch events from Soroban RPC:', err);
      return [];
    }
  }

  // Helper to fetch latest ledger sequence
  async getLatestLedger(): Promise<number> {
    try {
      const response = await this.server.getLatestLedger();
      return response.sequence;
    } catch (err) {
      console.warn('Failed to fetch latest ledger sequence:', err);
      return 0;
    }
  }
}
