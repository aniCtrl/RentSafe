import { DEFAULT_PLATFORM_ADMIN_ID } from '@/lib/stellar';
import type { DecodedEvent } from '@/hooks/useEventStream';
import type { NotificationType, NotificationSeverity } from '@/store/useAppStore';

export interface EventNotificationCopy {
  title: string;
  severity: NotificationSeverity;
  type: NotificationType;
}

export const EVENT_NOTIFICATION_COPY: Record<string, EventNotificationCopy> = {
  agreement_created: { title: 'Agreement created', severity: 'success', type: 'agreement' },
  deposit_locked: { title: 'Deposit locked', severity: 'success', type: 'agreement' },
  agreement_active: { title: 'Lease is active', severity: 'info', type: 'agreement' },
  refund_requested: { title: 'Refund requested', severity: 'info', type: 'agreement' },
  deduction_requested: { title: 'Deduction requested', severity: 'warning', type: 'agreement' },
  deduction_accepted: { title: 'Deduction accepted', severity: 'success', type: 'agreement' },
  deduction_rejected: { title: 'Deduction rejected', severity: 'warning', type: 'agreement' },
  dispute_raised: { title: 'Dispute raised', severity: 'warning', type: 'dispute' },
  dispute_registered: { title: 'Dispute registered', severity: 'warning', type: 'dispute' },
  evidence_submitted: { title: 'Evidence submitted', severity: 'info', type: 'dispute' },
  mutual_resolution_proposed: { title: 'Mutual settlement proposed', severity: 'info', type: 'dispute' },
  dispute_resolved: { title: 'Dispute resolved', severity: 'success', type: 'dispute' },
  settled: { title: 'Funds settled', severity: 'success', type: 'transaction' },
};

const ADMIN_RELEVANT_EVENTS = new Set([
  'dispute_raised',
  'dispute_registered',
  'evidence_submitted',
  'mutual_resolution_proposed',
  'dispute_resolved',
]);

export function isPlatformAdmin(address: string): boolean {
  return Boolean(address) && address.toLowerCase() === DEFAULT_PLATFORM_ADMIN_ID.toLowerCase();
}

export function isEventRelevant(event: DecodedEvent, address: string): boolean {
  const wallet = address.toLowerCase();
  if (isPlatformAdmin(wallet) && ADMIN_RELEVANT_EVENTS.has(event.type)) return true;
  return event.actorAddresses.some((actor) => actor.toLowerCase() === wallet);
}

export function notificationHref(event: DecodedEvent): string {
  return event.agreementId ? `/inspect-escrow/${event.agreementId}` : '/activity-feed';
}
