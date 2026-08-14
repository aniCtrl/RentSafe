import {
  DEFAULT_DISPUTE_ID,
  DEFAULT_ESCROW_ID,
  readContractView,
  writeContractMethod,
  writeContractMethodDetailed,
} from '@/lib/stellar';
import {
  AgreementRecord,
  DisputeRecord,
  decodeAgreement,
  decodeDispute,
  decodeMutualResolution,
  toNumber,
} from '@/lib/rentsafe';

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export class ContractService {
  static async getEscrowConfig() {
    const raw = asObject(await readContractView(DEFAULT_ESCROW_ID, 'get_config'));
    return {
      admin: String(raw.admin ?? ''),
      disputeContract: String(raw.dispute_contract ?? raw.disputeContract ?? DEFAULT_DISPUTE_ID),
      asset: String(raw.asset ?? ''),
    };
  }

  static async getAgreementIds(): Promise<number[]> {
    const raw = await readContractView(DEFAULT_ESCROW_ID, 'get_agreement_ids');
    if (!Array.isArray(raw)) return [];
    return raw.map((value) => toNumber(value)).filter((value) => Number.isFinite(value) && value > 0);
  }

  static async getAgreementDetails(agreementId: number | string): Promise<AgreementRecord> {
    const raw = await readContractView(DEFAULT_ESCROW_ID, 'get_agreement', [Number(agreementId)]);
    return decodeAgreement(raw, DEFAULT_ESCROW_ID);
  }

  static async createAgreement(
    params: {
      landlord: string;
      tenant: string;
      propertyDetails: string;
      depositAmount: bigint;
      rentAmount: bigint;
      leaseStart: number;
      leaseEnd: number;
    },
    userAddress: string,
  ) {
    const { txHash, returnValue } = await writeContractMethodDetailed(
      DEFAULT_ESCROW_ID,
      'create_agreement',
      [
        params.landlord,
        params.tenant,
        params.propertyDetails,
        params.depositAmount,
        params.rentAmount,
        params.leaseStart,
        params.leaseEnd,
      ],
      userAddress,
    );

    return {
      txHash,
      agreementId: toNumber(returnValue),
    };
  }

  static async lockDeposit(agreementId: number, userAddress: string) {
    return writeContractMethod(DEFAULT_ESCROW_ID, 'lock_deposit', [agreementId], userAddress);
  }

  static async requestFullRefund(agreementId: number, userAddress: string) {
    return writeContractMethod(DEFAULT_ESCROW_ID, 'request_full_refund', [agreementId], userAddress);
  }

  static async requestDeduction(
    agreementId: number,
    params: { amount: bigint; reason: string },
    userAddress: string,
  ) {
    return writeContractMethod(DEFAULT_ESCROW_ID, 'request_deduction', [agreementId, params.amount, params.reason], userAddress);
  }

  static async respondToDeduction(agreementId: number, accept: boolean, userAddress: string) {
    return writeContractMethod(DEFAULT_ESCROW_ID, 'respond_to_deduction', [agreementId, accept], userAddress);
  }

  static async raiseDispute(
    agreementId: number,
    params: { raisedBy: string; reason: string; evidenceRef: string },
    userAddress: string,
  ) {
    const { txHash, returnValue } = await writeContractMethodDetailed(
      DEFAULT_ESCROW_ID,
      'raise_dispute',
      [agreementId, params.raisedBy, params.reason, params.evidenceRef],
      userAddress,
    );

    return {
      txHash,
      disputeId: toNumber(returnValue),
    };
  }

  static async settle(agreementId: number, userAddress: string) {
    return writeContractMethod(DEFAULT_ESCROW_ID, 'settle', [agreementId], userAddress);
  }

  static async getDisputeDetails(disputeId: number | string): Promise<DisputeRecord> {
    const raw = await readContractView(DEFAULT_DISPUTE_ID, 'get_dispute', [Number(disputeId)]);
    const dispute = decodeDispute(raw);
    let mutualResolution = null;
    try {
      const proposalRaw = await readContractView(DEFAULT_DISPUTE_ID, 'get_mutual_resolution', [Number(disputeId)]);
      if (proposalRaw && typeof proposalRaw === 'object') {
        const proposal = proposalRaw as Record<string, unknown>;
        if (proposal.tag === 'Some') {
          const someValue = proposal.values ?? proposal.value ?? proposal.Some;
          mutualResolution = decodeMutualResolution(Array.isArray(someValue) ? someValue[0] : someValue);
        } else if (proposal.tag !== 'None') {
          mutualResolution = decodeMutualResolution(proposalRaw);
        }
      }
    } catch {
      // Older deployed dispute contracts do not expose mutual settlement yet.
    }
    return { ...dispute, mutualResolution };
  }

  static async getDisputeByAgreement(agreementId: number | string): Promise<DisputeRecord | null> {
    const raw = await readContractView(DEFAULT_DISPUTE_ID, 'get_dispute_by_agreement', [Number(agreementId)]);

    if (raw == null) return null;

    if (typeof raw === 'object' && raw !== null) {
      const option = asObject(raw);
      if (option.tag === 'None') return null;
      if (option.tag === 'Some') {
        const values = option.values;
        const disputeId = Array.isArray(values) ? values[0] : values;
        return this.getDisputeDetails(toNumber(disputeId));
      }
      if ('Some' in option) {
        return this.getDisputeDetails(toNumber(option.Some));
      }
    }

    return this.getDisputeDetails(toNumber(raw));
  }

  static async getDisputeIds(): Promise<number[]> {
    const raw = await readContractView(DEFAULT_DISPUTE_ID, 'get_dispute_ids');
    if (!Array.isArray(raw)) return [];
    return raw.map((value) => toNumber(value)).filter((value) => Number.isFinite(value) && value > 0);
  }

  static async submitDisputeEvidence(
    disputeId: number,
    params: { submitter: string; evidenceRef: string },
    userAddress: string,
  ) {
    return writeContractMethod(DEFAULT_DISPUTE_ID, 'submit_evidence', [disputeId, params.submitter, params.evidenceRef], userAddress);
  }

  static async proposeMutualResolution(
    disputeId: number,
    params: { landlordAmount: bigint; tenantAmount: bigint },
    userAddress: string,
  ) {
    return writeContractMethod(
      DEFAULT_DISPUTE_ID,
      'propose_mutual_resolution',
      [userAddress, disputeId, params.landlordAmount, params.tenantAmount],
      userAddress,
    );
  }

  static async resolveDispute(
    disputeId: number,
    params: { landlordAmount: bigint; tenantAmount: bigint },
    userAddress: string,
  ) {
    return writeContractMethod(
      DEFAULT_DISPUTE_ID,
      'resolve_dispute',
      [userAddress, disputeId, params.landlordAmount, params.tenantAmount],
      userAddress,
    );
  }
}
