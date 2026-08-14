'use client';

import { useEffect } from 'react';
import { useEventStream } from '@/hooks/useEventStream';
import { useAppStore } from '@/store/useAppStore';
import { EVENT_NOTIFICATION_COPY, isEventRelevant, notificationHref } from '@/lib/notifications';

export function useWalletNotifications() {
  const address = useAppStore((state) => state.address);
  const addNotification = useAppStore((state) => state.addNotification);
  const { events } = useEventStream();

  useEffect(() => {
    if (!address) return;

    events.forEach((event) => {
      const copy = EVENT_NOTIFICATION_COPY[event.type];
      if (!copy) return;
      if (!isEventRelevant(event, address)) return;

      addNotification({
        id: `event:${event.id}`,
        type: copy.type,
        severity: copy.severity,
        title: copy.title,
        message: event.message,
        timestamp: event.timestamp,
        read: false,
        agreementId: event.agreementId ? String(event.agreementId) : undefined,
        disputeId: event.disputeId,
        txHash: event.txHash,
        href: notificationHref(event),
      });
    });
  }, [address, addNotification, events]);
}
