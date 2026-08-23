import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import { getDisputeTimeline, getTimelineCurrentStep } from '@/lib/disputeTimeline';
import { isEventRelevant } from '@/lib/notifications';
import { DEFAULT_PLATFORM_ADMIN_ID } from '@/lib/stellar';
import { translateStellarError } from '@/lib/errors';
import { filterVisibleEvents, type DecodedEvent } from '@/hooks/useEventStream';

describe('review improvements', () => {
  beforeEach(() => {
    useAppStore.getState().resetSession();
    useAppStore.getState().setThemeMode('light');
    useAppStore.getState().clearNotifications();
  });

  it('maps every agreement lifecycle status to a guided step', () => {
    expect(getTimelineCurrentStep(0)).toBe(0);
    expect(getTimelineCurrentStep(1)).toBe(1);
    expect(getTimelineCurrentStep(2)).toBe(2);
    expect(getTimelineCurrentStep(3)).toBe(3);
    expect(getTimelineCurrentStep(4)).toBe(3);
    expect(getTimelineCurrentStep(5)).toBe(7);
    expect(getTimelineCurrentStep(6)).toBe(3);
    expect(getTimelineCurrentStep(7)).toBe(4);
    expect(getTimelineCurrentStep(8, 0)).toBe(5);
    expect(getTimelineCurrentStep(8, 1)).toBe(6);
    expect(getTimelineCurrentStep(8, 2)).toBe(7);
    expect(getTimelineCurrentStep(9)).toBe(10);
    expect(getTimelineCurrentStep(10)).toBe(10);
  });

  it('marks settled mutual disputes as fully complete', () => {
    const timeline = getDisputeTimeline(
      { status: 9, createdAt: 10, fundedAt: 20, deductionRequestedAt: 30, resolutionAt: 60 },
      { status: 2, createdAt: 40, evidence: [], outcomeResolvedAt: 60, hasOutcome: true, landlord: 'G_LANDLORD', tenant: 'G_TENANT', currentSettlementProposal: null },
      'Landlord',
    );

    expect(timeline.current.id).toBe('closed');
    expect(timeline.steps[8].state).toBe('completed');
    expect(timeline.steps[9].state).toBe('completed');
    expect(timeline.steps[8].timestamp).toBe(60);
    expect(timeline.steps[9].timestamp).toBe(60);
  });

  it('exposes the participant next action and evidence progress', () => {
    const timeline = getDisputeTimeline(
      { status: 8, createdAt: 10, fundedAt: 20, deductionRequestedAt: 30, resolutionAt: 0 },
      { status: 1, createdAt: 40, evidence: [{ submitter: 'GTEST', evidenceRef: 'ipfs://ref', submittedAt: 50 }], outcomeResolvedAt: 0, landlord: 'G_LANDLORD', tenant: 'G_TENANT', currentSettlementProposal: null },
      'Tenant',
    );

    expect(timeline.current.id).toBe('settlement-negotiation');
    expect(timeline.nextActor).toBe('You');
    expect(timeline.nextAction.toLowerCase()).toContain('make a settlement proposal');
    expect(timeline.steps[5].state).toBe('completed');
    expect(timeline.steps[5].timestamp).toBe(50);
  });

  it('guides landlord and tenant through participant settlement negotiation', () => {
    const agreement = { status: 8, createdAt: 10, fundedAt: 20, deductionRequestedAt: 30, resolutionAt: 0 };
    const currentSettlementProposal = {
      proposalId: 1,
      disputeId: 1,
      proposer: 'G_LANDLORD',
      landlordAmount: 300n,
      tenantAmount: 700n,
      reason: '',
      proposedAt: 40,
      respondedAt: 0,
      status: 0,
      statusLabel: 'Pending' as const,
    };
    const dispute = {
      status: 1,
      createdAt: 35,
      evidence: [],
      outcomeResolvedAt: 0,
      landlord: 'G_LANDLORD',
      tenant: 'G_TENANT',
      currentSettlementProposal,
    };

    const landlordTimeline = getDisputeTimeline(agreement, dispute, 'Landlord');
    const tenantTimeline = getDisputeTimeline(agreement, dispute, 'Tenant');

    expect(landlordTimeline.nextActor).toBe('Tenant');
    expect(landlordTimeline.nextAction).toContain('Waiting for tenant');
    expect(tenantTimeline.nextActor).toBe('You');
    expect(tenantTimeline.nextAction).toContain('accept, reject, or counter');
    expect(landlordTimeline.nextAction.toLowerCase()).not.toContain('arbitrator');
    expect(tenantTimeline.nextAction.toLowerCase()).not.toContain('arbitrator');
  });

  it('deduplicates transaction notifications and resets wallet-scoped records', () => {
    const store = useAppStore.getState();
    store.setAddress('G_WALLET_ONE');
    store.addTransaction({ id: 'tx-1', hash: '', type: 'fund', status: 'processing', description: 'Lock deposit' });
    store.updateTransactionStatus('tx-1', 'confirmed', 'hash-1');
    store.updateTransactionStatus('tx-1', 'confirmed', 'hash-1');

    expect(useAppStore.getState().notifications.map((item) => item.id)).toEqual([
      'transaction:tx-1:confirmed',
      'transaction:tx-1:processing',
    ]);

    store.markAllNotificationsRead();
    expect(useAppStore.getState().notifications.every((item) => item.read)).toBe(true);
    store.setAddress('G_WALLET_TWO');
    expect(useAppStore.getState().notifications).toEqual([]);
  });

  it('toggles and stores the selected theme mode', () => {
    const store = useAppStore.getState();
    expect(store.themeMode).toBe('light');
    store.toggleTheme();
    expect(useAppStore.getState().themeMode).toBe('dark');
  });

  it('keeps lifecycle notifications relevant to both parties and the platform admin', () => {
    const event = {
      id: 'event-1',
      ledger: 10,
      type: 'deposit_locked',
      message: 'Deposit locked',
      timestamp: 100,
      contractId: 'CAESCROW',
      agreementId: 1,
      actorAddresses: ['G_LANDLORD', 'G_TENANT'],
    };

    expect(isEventRelevant(event, 'g_landlord')).toBe(true);
    expect(isEventRelevant(event, 'g_tenant')).toBe(true);
    expect(isEventRelevant({ ...event, type: 'dispute_resolved', actorAddresses: [], agreementId: 1 }, DEFAULT_PLATFORM_ADMIN_ID)).toBe(true);
    expect(isEventRelevant(event, 'G_UNRELATED')).toBe(false);
  });

  it('keeps escrow and dispute activity together for a disputed agreement', () => {
    const event = (overrides: Partial<DecodedEvent>): DecodedEvent => ({
      id: 'event',
      ledger: 1,
      type: 'agreement_created',
      message: 'Activity',
      timestamp: 1,
      contractId: 'CONTRACT',
      actorAddresses: [],
      ...overrides,
    });

    const events = [
      event({ id: 'escrow-12', agreementId: 12, type: 'deposit_locked' }),
      event({ id: 'dispute-4', disputeId: 4, type: 'evidence_submitted' }),
      event({ id: 'escrow-13', agreementId: 13, type: 'deposit_locked' }),
      event({ id: 'dispute-5', disputeId: 5, type: 'evidence_submitted' }),
    ];

    expect(filterVisibleEvents(events, false, true, 12, true, 4).map(({ id }) => id)).toEqual([
      'escrow-12',
      'dispute-4',
    ]);
  });

  it('explains when a deployed contract is missing the mutual settlement entrypoint', () => {
    expect(translateStellarError(new Error('HostError: trying to invoke non-existent contract function, propose_mutual_resolution')))
      .toContain('contract is out of date');
  });
});
