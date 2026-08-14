import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import { getDisputeTimeline, getTimelineCurrentStep } from '@/lib/disputeTimeline';
import { isEventRelevant } from '@/lib/notifications';
import { DEFAULT_PLATFORM_ADMIN_ID } from '@/lib/stellar';

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
    expect(getTimelineCurrentStep(9)).toBe(8);
    expect(getTimelineCurrentStep(10)).toBe(9);
  });

  it('exposes the role-aware next action and evidence progress', () => {
    const timeline = getDisputeTimeline(
      { status: 8, createdAt: 10, fundedAt: 20, deductionRequestedAt: 30, resolutionAt: 0 },
      { status: 1, createdAt: 40, evidence: [{ submitter: 'GTEST', evidenceRef: 'ipfs://ref', submittedAt: 50 }], outcomeResolvedAt: 0 },
      'Arbitrator',
    );

    expect(timeline.current.id).toBe('awaiting-arbitration');
    expect(timeline.nextActor).toBe('You');
    expect(timeline.nextAction.toLowerCase()).toContain('review evidence');
    expect(timeline.steps[5].state).toBe('completed');
    expect(timeline.steps[5].timestamp).toBe(50);
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
});
