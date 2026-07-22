'use client';

import { useState, useEffect } from 'react';
import { server } from '@/lib/stellar';
import { useAppStore } from '@/store/useAppStore';
import { scValToNative } from '@stellar/stellar-sdk';

export interface DecodedEvent {
  id: string;
  ledger: number;
  type: string; // 'init' | 'funded' | 'active' | 'set_prop' | 'set_acc' | 'disputed' | 'resolved' | 'unknown'
  message: string;
  timestamp: number;
}

export function useEventStream(contractId: string) {
  const [events, setEvents] = useState<DecodedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const { network } = useAppStore();

  useEffect(() => {
    if (!contractId || contractId.length !== 56) return;

    let isSubscribed = true;
    let intervalId: NodeJS.Timeout;

    const pollEvents = async () => {
      try {
        const latestLedger = await server.getLatestLedger();
        // Look back ~1000 ledgers (roughly 1.5 hours of block history)
        const startLedger = Math.max(1, latestLedger.sequence - 1000);

        const response = await server.getEvents({
          startLedger,
          filters: [
            {
              type: 'contract',
              contractIds: [contractId],
            },
          ],
          limit: 30,
        });

        if (!isSubscribed) return;

        const decoded = response.events.map((evt) => {
          // Topics are ScVals representing symbol/strings.
          // Topic[0] is namespace, Topic[1] is action name.
          const topics = evt.topic.map((t) => {
            try {
              return scValToNative(t);
            } catch {
              return '';
            }
          });
          
          const action = topics[1] || '';
          let type = 'unknown';
          let message = 'Contract interaction detected';

          try {
            const rawVal = scValToNative(evt.value);
            
            // Map event actions
            if (action === 'init') {
              type = 'init';
              message = `Agreement initialized with Landlord: ${rawVal[0]?.slice(0, 6)}..., Tenant: ${rawVal[1]?.slice(0, 6)}...`;
            } else if (action === 'funded') {
              type = 'funded';
              const amtXlm = (Number(rawVal[1]) / 10000000).toFixed(0);
              message = `Tenant ${rawVal[0]?.slice(0, 6)}... locked ${amtXlm} XLM deposit`;
            } else if (action === 'active') {
              type = 'active';
              message = `Landlord ${rawVal[0]?.slice(0, 6)}... activated the lease`;
            } else if (action === 'set_prop') {
              type = 'set_prop';
              const lShare = (Number(rawVal[1]) / 10000000).toFixed(0);
              const tShare = (Number(rawVal[2]) / 10000000).toFixed(0);
              message = `Mutual Split proposed: Landlord ${lShare} XLM, Tenant ${tShare} XLM`;
            } else if (action === 'set_acc') {
              type = 'set_acc';
              const lShare = (Number(rawVal[0]) / 10000000).toFixed(0);
              const tShare = (Number(rawVal[1]) / 10000000).toFixed(0);
              message = `Mutual Split accepted: Landlord ${lShare} XLM, Tenant ${tShare} XLM distributed`;
            } else if (action === 'disputed') {
              type = 'disputed';
              message = `Dispute filed by ${rawVal[0]?.slice(0, 6)}...; funds locked in escrow`;
            } else if (action === 'resolved') {
              type = 'resolved';
              const lShare = (Number(rawVal[0]) / 10000000).toFixed(0);
              const tShare = (Number(rawVal[1]) / 10000000).toFixed(0);
              message = `Dispute resolved by Arbitrator: Landlord ${lShare} XLM, Tenant ${tShare} XLM distributed`;
            }
          } catch (valErr) {
            console.error('Failed to decode event value:', valErr);
          }

          return {
            id: evt.id,
            ledger: evt.ledger,
            type,
            message,
            timestamp: Date.now() - (latestLedger.sequence - evt.ledger) * 5000, // approximate block timestamp
          };
        });

        // Filter duplicates and sort descending
        setEvents((prev) => {
          const all = [...decoded, ...prev];
          const unique = all.filter((evt, idx, self) => self.findIndex((e) => e.id === evt.id) === idx);
          return unique.sort((a, b) => b.ledger - a.ledger);
        });
      } catch (err) {
        console.error('Error fetching event stream:', err);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    pollEvents();

    // Poll every 5 seconds
    intervalId = setInterval(pollEvents, 5000);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, [contractId, network]);

  return { events, loading };
}
