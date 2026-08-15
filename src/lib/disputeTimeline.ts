import type { AgreementRecord, DisputeRecord } from '@/lib/rentsafe';

export const DISPUTE_TIMELINE_STEPS = [
  { id: 'created', label: 'Agreement created', description: 'The rental terms are recorded on-chain.' },
  { id: 'deposit-locked', label: 'Deposit locked', description: 'The tenant deposit is held by the shared escrow contract.' },
  { id: 'lease-active', label: 'Lease active', description: 'The lease is active and the deposit remains protected.' },
  { id: 'move-out', label: 'Move-out decision', description: 'The landlord can request a refund or propose a deduction.' },
  { id: 'dispute-raised', label: 'Dispute raised', description: 'A disputed deduction has been registered for review.' },
  { id: 'evidence-submitted', label: 'Evidence submitted', description: 'The parties can add evidence references to the dispute.' },
  { id: 'awaiting-arbitration', label: 'Awaiting arbitration', description: 'An arbitrator must review the submitted evidence.' },
  { id: 'resolution-recorded', label: 'Resolution recorded', description: 'The outcome and fund split are recorded on-chain.' },
  { id: 'settled', label: 'Funds settled', description: 'The escrow funds have been disbursed.' },
  { id: 'closed', label: 'Agreement closed', description: 'The agreement lifecycle is complete.' },
] as const;

export type DisputeTimelineStepId = (typeof DISPUTE_TIMELINE_STEPS)[number]['id'];
export type TimelineRole = 'Landlord' | 'Tenant' | 'Arbitrator' | 'Viewer' | 'Guest';

export interface TimelineStepState {
  id: DisputeTimelineStepId;
  label: string;
  description: string;
  state: 'completed' | 'current' | 'upcoming';
  timestamp?: number;
  evidenceCount?: number;
  evidenceLabel?: string;
}

export interface TimelineSummary {
  currentStepIndex: number;
  current: (typeof DISPUTE_TIMELINE_STEPS)[number];
  explanation: string;
  nextActor: string;
  nextAction: string;
  steps: TimelineStepState[];
}

export function getTimelineCurrentStep(agreementStatus: number, disputeStatus?: number | null, hasOutcome = false): number {
  if (agreementStatus <= 0) return 0;
  if (agreementStatus === 1) return 1;
  if (agreementStatus === 2) return 2;
  if ([3, 4, 6].includes(agreementStatus)) return 3;
  if (agreementStatus === 5) return 7;
  if (agreementStatus === 7) return 4;
  if (agreementStatus === 8) {
    if (hasOutcome || disputeStatus === 2) return 7;
    if (disputeStatus === 1) return 6;
    return 5;
  }
  if (agreementStatus >= 9) return DISPUTE_TIMELINE_STEPS.length;
  return DISPUTE_TIMELINE_STEPS.length - 1;
}

function participantAction(role: TimelineRole, participant: 'Landlord' | 'Tenant' | 'Landlord or tenant', action: string) {
  const canAct = participant === 'Landlord or tenant'
    ? role === 'Landlord' || role === 'Tenant'
    : role === participant;
  const displayAction = `${action.charAt(0).toUpperCase()}${action.slice(1)}`;
  if (canAct) return { nextActor: 'You', nextAction: displayAction };
  return {
    nextActor: participant,
    nextAction: role === 'Viewer' || role === 'Guest' ? `Monitor ${participant.toLowerCase()} — ${displayAction}` : `Waiting for ${participant.toLowerCase()} to ${action.toLowerCase()}`,
  };
}

function getNextAction(agreementStatus: number, disputeStatus: number | undefined, role: TimelineRole, hasOutcome: boolean, hasDispute: boolean) {
  if (agreementStatus === 0) return participantAction(role, 'Tenant', 'lock the deposit');
  if (agreementStatus === 1 || agreementStatus === 2) return participantAction(role, 'Landlord', 'choose the move-out outcome');
  if (agreementStatus === 3 || agreementStatus === 5 || hasOutcome) return participantAction(role, 'Landlord or tenant', 'settle the recorded funds');
  if (agreementStatus === 4) return participantAction(role, 'Tenant', 'accept or reject the deduction');
  if (agreementStatus === 6) return participantAction(role, 'Landlord or tenant', 'raise a dispute with evidence');
  if (agreementStatus === 7 || agreementStatus === 8) {
    if (!hasDispute) return { nextActor: 'Dispute contract', nextAction: 'Waiting for dispute details from RPC' };
    if (disputeStatus === 2) return participantAction(role, 'Landlord or tenant', 'settle the arbitration outcome');
    if (disputeStatus === 0) {
      return role === 'Landlord' || role === 'Tenant'
        ? { nextActor: 'You', nextAction: 'submit evidence' }
        : { nextActor: 'Landlord or tenant', nextAction: 'Submit evidence' };
    }
    return role === 'Arbitrator'
      ? { nextActor: 'You', nextAction: 'review evidence and resolve the dispute' }
      : { nextActor: 'Arbitrator', nextAction: role === 'Viewer' || role === 'Guest' ? 'Monitor the arbitration decision' : 'Waiting for the arbitrator to review evidence' };
  }
  return { nextActor: 'No action required', nextAction: role === 'Viewer' || role === 'Guest' ? 'Monitor the agreement' : 'Agreement complete' };
}

export function getDisputeTimeline(
  agreement: Pick<AgreementRecord, 'status' | 'createdAt' | 'fundedAt' | 'deductionRequestedAt' | 'resolutionAt'>,
  dispute?: (Pick<DisputeRecord, 'status' | 'createdAt' | 'evidence' | 'outcomeResolvedAt'> & { hasOutcome?: boolean }) | null,
  role: TimelineRole = 'Viewer',
): TimelineSummary {
  const hasOutcome = Boolean(dispute?.hasOutcome || dispute?.outcomeResolvedAt || agreement.resolutionAt);
  const currentStepIndex = getTimelineCurrentStep(agreement.status, dispute?.status, hasOutcome);
  const action = getNextAction(agreement.status, dispute?.status, role, hasOutcome, Boolean(dispute));
  const evidenceCount = dispute?.evidence.length ?? 0;
  const timestamps: Array<number | undefined> = [
    agreement.createdAt,
    agreement.fundedAt,
    agreement.status >= 2 ? agreement.fundedAt : undefined,
    agreement.deductionRequestedAt || agreement.resolutionAt,
    dispute?.createdAt,
    dispute?.evidence[0]?.submittedAt,
    dispute?.status === 1 || dispute?.status === 2 ? dispute?.createdAt : undefined,
    agreement.resolutionAt || dispute?.outcomeResolvedAt,
    agreement.status >= 9 ? agreement.resolutionAt : undefined,
    agreement.status >= 9 ? agreement.resolutionAt : undefined,
  ];
  const currentStep = DISPUTE_TIMELINE_STEPS[Math.min(currentStepIndex, DISPUTE_TIMELINE_STEPS.length - 1)];

  return {
    currentStepIndex,
    current: currentStep,
    explanation: currentStep.description,
    nextActor: action.nextActor,
    nextAction: action.nextAction,
    steps: DISPUTE_TIMELINE_STEPS.map((step, index) => ({
      ...step,
      state: index < currentStepIndex ? 'completed' : index === currentStepIndex ? 'current' : 'upcoming',
      timestamp: timestamps[index] || undefined,
      ...(step.id === 'evidence-submitted' ? {
        evidenceCount,
        evidenceLabel: `${evidenceCount} evidence ${evidenceCount === 1 ? 'entry' : 'entries'} submitted`,
      } : {}),
    })),
  };
}
