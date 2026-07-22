export const AGREEMENT_STATUS_LABELS = [
  'Created',
  'Funded',
  'Active',
  'RefundRequested',
  'DeductionRequested',
  'DeductionAccepted',
  'DeductionRejected',
  'Disputed',
  'AwaitingArbitration',
  'Settled',
  'Closed',
] as const;

export const DISPUTE_STATUS_LABELS = ['Open', 'EvidenceSubmitted', 'Resolved'] as const;
export const RESOLUTION_SOURCE_LABELS = ['FullRefund', 'DeductionAccepted', 'Arbitration'] as const;

export type AgreementStatusLabel = (typeof AGREEMENT_STATUS_LABELS)[number];
export type DisputeStatusLabel = (typeof DISPUTE_STATUS_LABELS)[number];
export type ResolutionSourceLabel = (typeof RESOLUTION_SOURCE_LABELS)[number];

export interface EvidenceEntry {
  submitter: string;
  evidenceRef: string;
  submittedAt: number;
}

export interface AgreementRecord {
  agreementId: number;
  contractId: string;
  landlord: string;
  tenant: string;
  propertyDetails: string;
  depositAmount: bigint;
  rentAmount: bigint;
  leaseStart: number;
  leaseEnd: number;
  status: number;
  statusLabel: AgreementStatusLabel;
  createdAt: number;
  fundedAt: number;
  hasDeductionRequest: boolean;
  deductionAmount: bigint;
  deductionReason: string;
  deductionRequestedAt: number;
  hasDispute: boolean;
  disputeId: number;
  hasResolution: boolean;
  resolutionLandlordAmount: bigint;
  resolutionTenantAmount: bigint;
  resolutionSource: number;
  resolutionSourceLabel: ResolutionSourceLabel;
  resolutionAt: number;
  lockedBalance: string;
}

export interface DisputeRecord {
  disputeId: number;
  agreementId: number;
  landlord: string;
  tenant: string;
  raisedBy: string;
  reason: string;
  status: number;
  statusLabel: DisputeStatusLabel;
  createdAt: number;
  evidence: EvidenceEntry[];
  hasOutcome: boolean;
  outcomeLandlordAmount: bigint;
  outcomeTenantAmount: bigint;
  outcomeResolvedAt: number;
  resolutionTxHash?: string;
}

const getField = <T = unknown>(value: any, ...keys: string[]): T | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  for (const key of keys) {
    if (key in value) return value[key] as T;
  }
  return undefined;
};

export const toBigInt = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      return BigInt(value);
    } catch {
      return BigInt(0);
    }
  }
  return BigInt(0);
};

export const toNumber = (value: unknown): number => Number(toBigInt(value));

export const toAddress = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') {
    return value.toString();
  }
  return '';
};

const enumLabelFromValue = <T extends readonly string[]>(value: unknown, labels: T, fallback: T[number]): T[number] => {
  if (typeof value === 'number' && labels[value]) return labels[value];
  if (typeof value === 'string') {
    if (/^\d+$/.test(value) && labels[Number(value)]) return labels[Number(value)];
    const direct = labels.find((label) => label === value);
    if (direct) return direct;
  }

  if (value && typeof value === 'object') {
    const tag = getField<string>(value, 'tag');
    if (tag) {
      const direct = labels.find((label) => label === tag);
      if (direct) return direct;
    }

    const keys = Object.keys(value);
    if (keys.length === 1) {
      const direct = labels.find((label) => label === keys[0]);
      if (direct) return direct;
    }
  }

  return fallback;
};

export const agreementStatusLabelFromValue = (value: unknown): AgreementStatusLabel =>
  enumLabelFromValue(value, AGREEMENT_STATUS_LABELS, 'Created');

export const disputeStatusLabelFromValue = (value: unknown): DisputeStatusLabel =>
  enumLabelFromValue(value, DISPUTE_STATUS_LABELS, 'Open');

export const resolutionSourceLabelFromValue = (value: unknown): ResolutionSourceLabel =>
  enumLabelFromValue(value, RESOLUTION_SOURCE_LABELS, 'FullRefund');

export const agreementStatusCodeFromValue = (value: unknown): number =>
  AGREEMENT_STATUS_LABELS.indexOf(agreementStatusLabelFromValue(value));

export const disputeStatusCodeFromValue = (value: unknown): number =>
  DISPUTE_STATUS_LABELS.indexOf(disputeStatusLabelFromValue(value));

export const resolutionSourceCodeFromValue = (value: unknown): number =>
  RESOLUTION_SOURCE_LABELS.indexOf(resolutionSourceLabelFromValue(value));

export const formatStroopsToXlm = (stroops: bigint | number | string) => (Number(stroops) / 10000000).toFixed(2);

export const shortAddress = (address: string, left = 6, right = 4) => {
  if (!address) return '—';
  if (address.length <= left + right) return address;
  return `${address.slice(0, left)}...${address.slice(-right)}`;
};

export const formatTimestamp = (timestamp: number) => {
  if (!timestamp) return '—';
  return new Date(timestamp * 1000).toLocaleString();
};

export const hasLockedFunds = (status: number) => ![0, 9, 10].includes(status);

export const decodeAgreement = (raw: unknown, contractId: string): AgreementRecord => {
  const agreementId = toNumber(getField(raw, 'id'));
  const depositAmount = toBigInt(getField(raw, 'deposit_amount', 'depositAmount'));
  const statusValue = getField(raw, 'status');
  const resolutionSourceValue = getField(raw, 'resolution_source', 'resolutionSource');
  const status = agreementStatusCodeFromValue(statusValue);

  return {
    agreementId,
    contractId,
    landlord: toAddress(getField(raw, 'landlord')),
    tenant: toAddress(getField(raw, 'tenant')),
    propertyDetails: String(getField(raw, 'property_details', 'propertyDetails') ?? ''),
    depositAmount,
    rentAmount: toBigInt(getField(raw, 'rent_amount', 'rentAmount')),
    leaseStart: toNumber(getField(raw, 'lease_start', 'leaseStart')),
    leaseEnd: toNumber(getField(raw, 'lease_end', 'leaseEnd')),
    status,
    statusLabel: agreementStatusLabelFromValue(statusValue),
    createdAt: toNumber(getField(raw, 'created_at', 'createdAt')),
    fundedAt: toNumber(getField(raw, 'funded_at', 'fundedAt')),
    hasDeductionRequest: Boolean(getField(raw, 'has_deduction_request', 'hasDeductionRequest')),
    deductionAmount: toBigInt(getField(raw, 'deduction_amount', 'deductionAmount')),
    deductionReason: String(getField(raw, 'deduction_reason', 'deductionReason') ?? ''),
    deductionRequestedAt: toNumber(getField(raw, 'deduction_requested_at', 'deductionRequestedAt')),
    hasDispute: Boolean(getField(raw, 'has_dispute', 'hasDispute')),
    disputeId: toNumber(getField(raw, 'dispute_id', 'disputeId')),
    hasResolution: Boolean(getField(raw, 'has_resolution', 'hasResolution')),
    resolutionLandlordAmount: toBigInt(getField(raw, 'resolution_landlord_amount', 'resolutionLandlordAmount')),
    resolutionTenantAmount: toBigInt(getField(raw, 'resolution_tenant_amount', 'resolutionTenantAmount')),
    resolutionSource: resolutionSourceCodeFromValue(resolutionSourceValue),
    resolutionSourceLabel: resolutionSourceLabelFromValue(resolutionSourceValue),
    resolutionAt: toNumber(getField(raw, 'resolution_at', 'resolutionAt')),
    lockedBalance: hasLockedFunds(status) ? formatStroopsToXlm(depositAmount) : '0.00',
  };
};

export const decodeEvidenceEntry = (raw: unknown): EvidenceEntry => ({
  submitter: toAddress(getField(raw, 'submitter')),
  evidenceRef: String(getField(raw, 'evidence_ref', 'evidenceRef') ?? ''),
  submittedAt: toNumber(getField(raw, 'submitted_at', 'submittedAt')),
});

export const decodeDispute = (raw: unknown): DisputeRecord => {
  const statusValue = getField(raw, 'status');
  const evidenceRaw = getField<unknown[]>(raw, 'evidence') ?? [];

  return {
    disputeId: toNumber(getField(raw, 'id')),
    agreementId: toNumber(getField(raw, 'agreement_id', 'agreementId')),
    landlord: toAddress(getField(raw, 'landlord')),
    tenant: toAddress(getField(raw, 'tenant')),
    raisedBy: toAddress(getField(raw, 'raised_by', 'raisedBy')),
    reason: String(getField(raw, 'reason') ?? ''),
    status: disputeStatusCodeFromValue(statusValue),
    statusLabel: disputeStatusLabelFromValue(statusValue),
    createdAt: toNumber(getField(raw, 'created_at', 'createdAt')),
    evidence: Array.isArray(evidenceRaw) ? evidenceRaw.map(decodeEvidenceEntry) : [],
    hasOutcome: Boolean(getField(raw, 'has_outcome', 'hasOutcome')),
    outcomeLandlordAmount: toBigInt(getField(raw, 'outcome_landlord_amount', 'outcomeLandlordAmount')),
    outcomeTenantAmount: toBigInt(getField(raw, 'outcome_tenant_amount', 'outcomeTenantAmount')),
    outcomeResolvedAt: toNumber(getField(raw, 'outcome_resolved_at', 'outcomeResolvedAt')),
  };
};
