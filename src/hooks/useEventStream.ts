'use client';

import { useEffect, useState } from 'react';
import { scValToNative } from '@stellar/stellar-sdk';
import { DEFAULT_DISPUTE_ID, DEFAULT_ESCROW_ID, server } from '@/lib/stellar';
import { formatStroopsToXlm, shortAddress } from '@/lib/rentsafe';

export interface DecodedEvent {
  id: string;
  ledger: number;
  type: string;
  message: string;
  timestamp: number;
}

const asTuple = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asStroopsLike = (value: unknown): string | number | bigint =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' ? value : 0;

export function useEventStream(agreementId?: number | string | null, disputeId?: number | string | null) {
  const [events, setEvents] = useState<DecodedEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const numericAgreementId = Number(agreementId);
  const numericDisputeId = Number(disputeId);
  const isValidAgreementId = !!agreementId && Number.isFinite(numericAgreementId) && numericAgreementId > 0;
  const hasDisputeFilter = !!disputeId && Number.isFinite(numericDisputeId) && numericDisputeId > 0;

  useEffect(() => {
    if (!isValidAgreementId) {
      return;
    }

    type ContractEventRecord = {
      id: string;
      ledger: number;
      topic?: unknown[];
      topics?: unknown[];
      value: unknown;
      contractId?: string;
    };

    let cancelled = false;
    const decodeMessage = (action: string, value: unknown) => {
      const parts = asTuple(value);
      switch (action) {
        case 'agreement_created':
          return `Agreement created for ${shortAddress(String(parts[0] ?? ''))} ↔ ${shortAddress(String(parts[1] ?? ''))}`;
        case 'deposit_locked':
          return `${shortAddress(String(parts[0] ?? ''))} locked ${formatStroopsToXlm(asStroopsLike(parts[1]))} XLM deposit`;
        case 'agreement_active':
          return `Agreement activated between ${shortAddress(String(parts[0] ?? ''))} and ${shortAddress(String(parts[1] ?? ''))}`;
        case 'refund_requested':
          return `Landlord requested full refund of ${formatStroopsToXlm(asStroopsLike(parts[1]))} XLM to tenant`;
        case 'deduction_requested':
          return `Deduction requested: ${formatStroopsToXlm(asStroopsLike(parts[1]))} XLM — ${String(parts[2] ?? '')}`;
        case 'deduction_accepted':
          return `Tenant accepted deduction of ${formatStroopsToXlm(asStroopsLike(parts[1]))} XLM`;
        case 'deduction_rejected':
          return `Tenant rejected deduction of ${formatStroopsToXlm(asStroopsLike(parts[1]))} XLM`;
        case 'dispute_raised':
          return `Dispute #${Number(parts[0] ?? 0)} raised by ${shortAddress(String(parts[1] ?? ''))}`;
        case 'dispute_resolved':
          return `Dispute resolved: ${formatStroopsToXlm(asStroopsLike(parts[0]))} XLM to landlord, ${formatStroopsToXlm(asStroopsLike(parts[1]))} XLM to tenant`;
        case 'settled':
          return `Agreement settled: ${formatStroopsToXlm(asStroopsLike(parts[0]))} XLM to landlord, ${formatStroopsToXlm(asStroopsLike(parts[1]))} XLM to tenant`;
        case 'dispute_registered':
          return `Dispute registered for agreement #${Number(parts[0] ?? 0)}`;
        case 'evidence_submitted':
          return `Additional evidence submitted by ${shortAddress(String(parts[0] ?? ''))}`;
        default:
          return 'Agreement activity detected on-chain';
      }
    };

    const pollEvents = async () => {
      try {
        setLoading(true);
        const latestLedger = await server.getLatestLedger();
        const startLedger = Math.max(1, latestLedger.sequence - 60000);
        const response = await (server as unknown as {
          getEvents: (args: {
            startLedger: number;
            filters: Array<{ type: string; contractIds: string[] }>;
            limit: number;
          }) => Promise<{ events?: ContractEventRecord[] }>;
        }).getEvents({
          startLedger,
          filters: [{ type: 'contract', contractIds: hasDisputeFilter ? [DEFAULT_ESCROW_ID, DEFAULT_DISPUTE_ID] : [DEFAULT_ESCROW_ID] }],
          limit: 200,
        });

        if (cancelled) return;

        const decoded = (response.events ?? [])
          .map((event) => {
            const topics = (event.topic || event.topics || []).map((topic) => {
              try {
                return scValToNative(topic as Parameters<typeof scValToNative>[0]);
              } catch {
                return null;
              }
            });

            const action = String(topics[0] ?? '');
            const eventId = Number(topics[1] ?? 0);
            const isEscrowEvent = event.contractId === DEFAULT_ESCROW_ID;
            const isDisputeEvent = event.contractId === DEFAULT_DISPUTE_ID;

            if (isEscrowEvent && eventId !== numericAgreementId) {
              return null;
            }
            if (isDisputeEvent && (!hasDisputeFilter || eventId !== numericDisputeId)) {
              return null;
            }

            let value: unknown = null;
            try {
              value = scValToNative(event.value as Parameters<typeof scValToNative>[0]);
            } catch {
              value = null;
            }

            return {
              id: event.id,
              ledger: event.ledger,
              type: action,
              message: decodeMessage(action, value),
              timestamp: Date.now() - Math.max(0, latestLedger.sequence - event.ledger) * 5000,
            } satisfies DecodedEvent;
          })
          .filter((event: DecodedEvent | null): event is DecodedEvent => event !== null)
          .sort((a: DecodedEvent, b: DecodedEvent) => b.ledger - a.ledger);

        setEvents(decoded);
      } catch (error) {
        console.error('Error fetching agreement event stream:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void pollEvents();
    const intervalId = setInterval(pollEvents, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [agreementId, disputeId, hasDisputeFilter, isValidAgreementId, numericAgreementId, numericDisputeId]);

  return { events: isValidAgreementId ? events : [], loading: isValidAgreementId ? loading : false };
}
