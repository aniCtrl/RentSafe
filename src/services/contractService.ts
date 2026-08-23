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
  SettlementProposalRecord,
  decodeAgreement,
  decodeDispute,
  decodeMutualResolution,
  decodeSettlementProposal,
  toNumber,
} from '@/lib/rentsafe';

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const unwrapOptional = (value: unknown): unknown | null => {
  if (!value || typeof value !== 'object') return value ?? null;
  const option = asObject(value);
  if (option.tag === 'None' || 'None' in option) return null;
  if (option.tag === 'Some') {
    const someValue = option.values ?? option.value ?? option.Some;
    return Array.isArray(someValue) ? someValue[0] ?? null : someValue ?? null;
  }
  if ('Some' in option) {
    const someValue = option.Some;
    return Array.isArray(someValue) ? someValue[0] ?? null : someValue ?? null;
  }
  return value;
};

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
    let currentSettlementProposal = null;
    let settlementProposals: SettlementProposalRecord[] = [];
    try {
      const proposalRaw = await readContractView(DEFAULT_DISPUTE_ID, 'get_mutual_resolution', [Number(disputeId)]);
      const proposal = unwrapOptional(proposalRaw);
      if (proposal) mutualResolution = decodeMutualResolution(proposal);
    } catch {
      // Older deployed dispute contracts do not expose mutual settlement yet.
    }
    try {
      const historyRaw = await readContractView(DEFAULT_DISPUTE_ID, 'get_settlement_proposals', [Number(disputeId)]);
      const history = unwrapOptional(historyRaw);
      if (Array.isArray(history)) settlementProposals = history.map(decodeSettlementProposal);
    } catch {
      // Older deployed dispute contracts do not expose negotiated proposals yet.
    }
    try {
      const currentRaw = await readContractView(DEFAULT_DISPUTE_ID, 'get_current_settlement_proposal', [Number(disputeId)]);
      const current = unwrapOptional(currentRaw);
      if (current) currentSettlementProposal = decodeSettlementProposal(current);
    } catch {
      // Older deployed dispute contracts do not expose negotiated proposals yet.
    }
    return { ...dispute, mutualResolution, currentSettlementProposal, settlementProposals };
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

  static async createSettlementProposal(
    disputeId: number,
    params: { landlordAmount: bigint; tenantAmount: bigint; reason?: string },
    userAddress: string,
  ) {
    const { txHash, returnValue } = await writeContractMethodDetailed(
      DEFAULT_DISPUTE_ID,
      'create_settlement_proposal',
      [userAddress, disputeId, params.landlordAmount, params.tenantAmount, params.reason ?? ''],
      userAddress,
    );

    return { txHash, proposalId: toNumber(returnValue) };
  }

  static async acceptSettlementProposal(
    disputeId: number,
    proposalId: number,
    userAddress: string,
  ) {
    return writeContractMethod(
      DEFAULT_DISPUTE_ID,
      'accept_settlement_proposal',
      [userAddress, disputeId, proposalId],
      userAddress,
    );
  }

  static async rejectSettlementProposal(
    disputeId: number,
    proposalId: number,
    userAddress: string,
  ) {
    return writeContractMethod(
      DEFAULT_DISPUTE_ID,
      'reject_settlement_proposal',
      [userAddress, disputeId, proposalId],
      userAddress,
    );
  }

  static async counterSettlementProposal(
    disputeId: number,
    proposalId: number,
    params: { landlordAmount: bigint; tenantAmount: bigint; reason?: string },
    userAddress: string,
  ) {
    const { txHash, returnValue } = await writeContractMethodDetailed(
      DEFAULT_DISPUTE_ID,
      'counter_settlement_proposal',
      [
        userAddress,
        disputeId,
        proposalId,
        params.landlordAmount,
        params.tenantAmount,
        params.reason ?? '',
      ],
      userAddress,
    );

    return { txHash, proposalId: toNumber(returnValue) };
  }

}
