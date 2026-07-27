import { Client as EscrowClient } from '@/bindings/escrow/src';
import { Client as DisputeClient } from '@/bindings/dispute/src';
import { Networks as StellarNetworks, Operation, Address, TransactionBuilder, xdr, scValToNative } from '@stellar/stellar-sdk';
import { initializeWalletsKit, server, DEFAULT_ESCROW_WASM_HASH, DEFAULT_DISPUTE_WASM_HASH } from '@/lib/stellar';
import { clearSettlementProposer, getSettlementProposer, markSettlementProposed } from '@/lib/knownEscrows';
import { useAppStore } from '@/store/useAppStore';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = StellarNetworks.TESTNET; // "Test SDF Network ; September 2015"

// Helper to get custom signer options for the contract Client
const getClientOptions = (contractId: string, userAddress?: string) => {
  return {
    contractId,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey: userAddress,
    signTransaction: async (xdr: string) => {
      const { network, walletId } = useAppStore.getState();
      await initializeWalletsKit(network, walletId || undefined);
      const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr);
      return { signedTxXdr };
    }
  };
};

export class ContractService {
  // Read operations
  static async getEscrowDetails(escrowId: string) {
    const client = new EscrowClient(getClientOptions(escrowId));
    
    // Simulate reads and unwrap Results
    const landlordRes = await client.get_landlord();
    const tenantRes = await client.get_tenant();
    const arbitratorRes = await client.get_arbitrator();
    const tokenRes = await client.get_token();
    const amountRes = await client.get_amount();
    const stateRes = await client.get_state();
    const stateVal = stateRes.result.unwrap();

    let disputeContract = '';
    try {
      const disputeRes = await client.get_dispute_contract();
      disputeContract = disputeRes.result.unwrap();
    } catch {
      disputeContract = 'Not Linked Yet';
    }

    let proposedBy = '';
    if (stateVal === 3) {
      proposedBy = getSettlementProposer(escrowId) || '';
      try {
        const latestLedger = await server.getLatestLedger();
        // Look back ~60,000 ledgers (~3 days of testnet history) so older pending proposals still resolve.
        const startLedger = Math.max(1, latestLedger.sequence - 60000);
        const response = await (server as any).getEvents({
          startLedger,
          filters: [{
            type: 'contract',
            contractIds: [escrowId]
          }],
          limit: 200
        });

        const propEvents = response.events.filter((evt: any) => {
          try {
            const topics = evt.topic || evt.topics || [];
            const topicStrings = topics.map((t: any) => String(scValToNative(t)));
            return topicStrings[0] === 'escrow' && topicStrings[1] === 'set_prop';
          } catch {
            return false;
          }
        });

        if (propEvents.length > 0) {
          const latestEvt = propEvents[propEvents.length - 1];
          const val = scValToNative(latestEvt.value);
          if (Array.isArray(val) && val.length > 0) {
            proposedBy = String(val[0]);
            // Always refresh the cache from chain so counter-proposals don't leave stale local state behind.
            markSettlementProposed(escrowId, proposedBy);
          }
        }
      } catch (evtErr) {
        console.error('Failed to resolve settlement proposer:', evtErr);
      }
    } else {
      clearSettlementProposer(escrowId);
    }

    return {
      address: escrowId,
      landlord: landlordRes.result.unwrap(),
      tenant: tenantRes.result.unwrap(),
      arbitrator: arbitratorRes.result.unwrap(),
      token: tokenRes.result.unwrap(),
      amount: amountRes.result.unwrap(),
      state: stateVal,
      disputeContract,
      proposedBy
    };
  }

  static async getDisputeDetails(disputeId: string) {
    const client = new DisputeClient(getClientOptions(disputeId));
    
    const stateRes = await client.get_state();
    const escrowRes = await client.get_escrow();
    const arbitratorRes = await client.get_arbitrator();
    const disputerRes = await client.get_disputer();
    
    let evidenceHashHex = '';
    try {
      const evidenceRes = await client.get_evidence_hash();
      evidenceHashHex = Buffer.from(evidenceRes.result.unwrap()).toString('hex');
    } catch {
      evidenceHashHex = '';
    }

    return {
      state: stateRes.result.unwrap(),
      escrow: escrowRes.result.unwrap(),
      arbitrator: arbitratorRes.result.unwrap(),
      disputer: disputerRes.result.unwrap(),
      evidenceHash: evidenceHashHex
    };
  }

  // Write operations
  static async initializeEscrow(
    escrowId: string,
    params: { landlord: string; tenant: string; arbitrator: string; token: string; amount: bigint },
    userAddress: string
  ) {
    const client = new EscrowClient(getClientOptions(escrowId, userAddress));
    const tx = await client.initialize(params);
    const sentTx = await tx.signAndSend();
    return sentTx.sendTransactionResponse?.hash || '';
  }

  static async fundEscrow(escrowId: string, userAddress: string) {
    const client = new EscrowClient(getClientOptions(escrowId, userAddress));
    const tx = await client.fund();
    const sentTx = await tx.signAndSend();
    return sentTx.sendTransactionResponse?.hash || '';
  }

  static async activateEscrow(escrowId: string, userAddress: string) {
    const client = new EscrowClient(getClientOptions(escrowId, userAddress));
    const tx = await client.activate();
    const sentTx = await tx.signAndSend();
    return sentTx.sendTransactionResponse?.hash || '';
  }

  static async requestSettlement(
    escrowId: string,
    params: { caller: string; landlord_share: bigint; tenant_share: bigint },
    userAddress: string
  ) {
    const client = new EscrowClient(getClientOptions(escrowId, userAddress));
    const tx = await client.request_settlement(params);
    const sentTx = await tx.signAndSend();
    markSettlementProposed(escrowId, userAddress);
    return sentTx.sendTransactionResponse?.hash || '';
  }

  static async acceptSettlement(escrowId: string, userAddress: string) {
    const client = new EscrowClient(getClientOptions(escrowId, userAddress));
    const tx = await client.accept_settlement({ caller: userAddress });
    const sentTx = await tx.signAndSend();
    clearSettlementProposer(escrowId);
    return sentTx.sendTransactionResponse?.hash || '';
  }

  static async raiseDispute(
    escrowId: string,
    params: { caller: string; evidence_hash: Buffer },
    userAddress: string
  ) {
    const client = new EscrowClient(getClientOptions(escrowId, userAddress));
    const tx = await client.dispute(params);
    const sentTx = await tx.signAndSend();
    clearSettlementProposer(escrowId);
    return sentTx.sendTransactionResponse?.hash || '';
  }

  static async setDisputeContract(escrowId: string, disputeContract: string, userAddress: string) {
    const client = new EscrowClient(getClientOptions(escrowId, userAddress));
    const tx = await client.set_dispute_contract({ dispute_contract: disputeContract });
    const sentTx = await tx.signAndSend();
    return sentTx.sendTransactionResponse?.hash || '';
  }

  static async resolveDispute(
    disputeId: string,
    params: { landlord_share: bigint; tenant_share: bigint },
    userAddress: string
  ) {
    const client = new DisputeClient(getClientOptions(disputeId, userAddress));
    const tx = await client.resolve(params);
    const sentTx = await tx.signAndSend();
    return sentTx.sendTransactionResponse?.hash || '';
  }

  static async deployEscrowInstance(userAddress: string): Promise<{ contractId: string; txHash: string }> {
    const sourceAccount = await server.getAccount(userAddress);

    // Generate a cryptographically random 32-byte salt
    const salt = new Uint8Array(32);
    if (typeof window !== 'undefined') {
      window.crypto.getRandomValues(salt);
    } else {
      const cryptoNode = require('crypto');
      cryptoNode.randomFillSync(salt);
    }

    let transaction = new TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: StellarNetworks.TESTNET,
    })
    .addOperation(
      Operation.createCustomContract({
        address: new Address(userAddress),
        wasmHash: Buffer.from(DEFAULT_ESCROW_WASM_HASH, 'hex'),
        salt: Buffer.from(salt),
      })
    )
    .setTimeout(30)
    .build();

    // Attach resource footprint and fee via RPC simulation
    transaction = await server.prepareTransaction(transaction);

    // Request wallet signature
    const { network, walletId } = useAppStore.getState();
    await initializeWalletsKit(network, walletId || undefined);
    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(transaction.toXDR());

    // Submit signed transaction
    const finalTx = TransactionBuilder.fromXDR(signedTxXdr, StellarNetworks.TESTNET);
    const submitResult = await server.sendTransaction(finalTx) as any;

    if (submitResult.status === 'ERROR') {
      throw new Error(`Transaction submission error: ${JSON.stringify(submitResult.errorResultXdr)}`);
    }

    const txHash = submitResult.hash;

    // ── Poll until confirmed ──────────────────────────────────────────────────
    // The RPC returns 'NOT_FOUND' during ledger indexing (3-5s lag). Treat it
    // like 'PENDING'. Only stop on 'SUCCESS', 'FAILED', or timeout.
    let txDetails: any = null;
    let attempts = 0;

    if (submitResult.status === 'SUCCESS') {
      txDetails = await server.getTransaction(txHash);
    }

    while (!txDetails && attempts < 30) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const poll = await server.getTransaction(txHash) as any;
      if (poll.status === 'SUCCESS') {
        txDetails = poll;
        break;
      } else if (poll.status === 'FAILED') {
        throw new Error(`Deploy transaction failed on-chain.`);
      }
      // status 'NOT_FOUND' or 'PENDING' → keep waiting
      attempts++;
    }

    if (!txDetails) {
      throw new Error('Deploy transaction timed out waiting for on-chain confirmation.');
    }

    // ── Extract the deployed contract ID from the confirmed result ────────────
    // The return value of createCustomContract is the new contract's ScAddress,
    // stored in TransactionMeta v3 → sorobanMeta → returnValue.
    // NOTE: Use xdr.TransactionMeta (NOT xdr.TransactionResultMeta — different type).
    try {
      const meta = xdr.TransactionMeta.fromXDR(txDetails.resultMetaXdr, 'base64') as any;
      const sorobanMeta = meta.v3?.()?.sorobanMeta?.();
      if (sorobanMeta) {
        const returnScVal = sorobanMeta.returnValue?.();
        if (returnScVal) {
          // scValToNative on a scvAddress returns an Address object (not a plain string)
          const native = scValToNative(returnScVal);
          // Address.toString() gives the StrKey "C..." representation
          const contractId: string = typeof native === 'string' ? native : native?.toString?.() ?? '';
          if (contractId.length === 56 && contractId.startsWith('C')) {
            console.log('[deployEscrowInstance] Contract ID from metadata:', contractId, '| Tx:', txHash);
            return { contractId, txHash };
          }
        }
      }
      throw new Error('Could not locate contract address in transaction metadata.');
    } catch (err: any) {
      console.error('[deployEscrowInstance] Metadata parse error:', err);
      throw new Error(`Deploy confirmed (tx: ${txHash}) but could not extract contract ID: ${err.message}`);
    }
  }

  static async deployDisputeInstance(userAddress: string): Promise<{ contractId: string; txHash: string }> {
    const sourceAccount = await server.getAccount(userAddress);

    const salt = new Uint8Array(32);
    if (typeof window !== 'undefined') {
      window.crypto.getRandomValues(salt);
    } else {
      const cryptoNode = require('crypto');
      cryptoNode.randomFillSync(salt);
    }

    let transaction = new TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: StellarNetworks.TESTNET,
    })
    .addOperation(
      Operation.createCustomContract({
        address: new Address(userAddress),
        wasmHash: Buffer.from(DEFAULT_DISPUTE_WASM_HASH, 'hex'),
        salt: Buffer.from(salt),
      })
    )
    .setTimeout(30)
    .build();

    transaction = await server.prepareTransaction(transaction);

    const { network, walletId } = useAppStore.getState();
    await initializeWalletsKit(network, walletId || undefined);
    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(transaction.toXDR());

    const finalTx = TransactionBuilder.fromXDR(signedTxXdr, StellarNetworks.TESTNET);
    const submitResult = await server.sendTransaction(finalTx) as any;

    if (submitResult.status === 'ERROR') {
      throw new Error(`Transaction submission error: ${JSON.stringify(submitResult.errorResultXdr)}`);
    }

    const txHash = submitResult.hash;
    let txDetails: any = null;
    let attempts = 0;

    if (submitResult.status === 'SUCCESS') {
      txDetails = await server.getTransaction(txHash);
    }

    while (!txDetails && attempts < 30) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const poll = await server.getTransaction(txHash) as any;
      if (poll.status === 'SUCCESS') { txDetails = poll; break; }
      else if (poll.status === 'FAILED') { throw new Error('Deploy dispute transaction failed on-chain.'); }
      attempts++;
    }

    if (!txDetails) throw new Error('Deploy dispute transaction timed out.');

    try {
      const meta = xdr.TransactionMeta.fromXDR(txDetails.resultMetaXdr, 'base64') as any;
      const sorobanMeta = meta.v3?.()?.sorobanMeta?.();
      if (sorobanMeta) {
        const returnScVal = sorobanMeta.returnValue?.();
        if (returnScVal) {
          const native = scValToNative(returnScVal);
          const contractId: string = typeof native === 'string' ? native : native?.toString?.() ?? '';
          if (contractId.length === 56 && contractId.startsWith('C')) {
            return { contractId, txHash };
          }
        }
      }
      throw new Error('Could not locate contract address in transaction metadata.');
    } catch (err: any) {
      throw new Error(`Dispute deploy confirmed (tx: ${txHash}) but could not extract contract ID: ${err.message}`);
    }
  }

  static async initializeDisputeContract(
    disputeId: string,
    escrowContract: string,
    arbitrator: string,
    userAddress: string
  ) {
    const client = new DisputeClient(getClientOptions(disputeId, userAddress));
    const tx = await client.initialize({ escrow_contract: escrowContract, arbitrator });
    const sentTx = await tx.signAndSend();
    return sentTx.sendTransactionResponse?.hash || '';
  }
}
