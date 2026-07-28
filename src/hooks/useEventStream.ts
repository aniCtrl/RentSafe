'use client';

import { useEffect, useState, useRef } from 'react';
import { scValToNative, rpc, Contract } from '@stellar/stellar-sdk';
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

function contractIdToString(raw: Contract | string | undefined | null): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw.toUpperCase();
  try {
    return raw.contractId().toUpperCase();
  } catch {
    try {
      return raw.toString().toUpperCase();
    } catch {
      return '';
    }
  }
}

const LEDGER_LOOKBACK = 5_000;

export function useEventStream(agreementId?: number | string | null, disputeId?: number | string | null) {
  const [events, setEvents] = useState<DecodedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAgreementId = Number(agreementId);
  const numericDisputeId = Number(disputeId);
  const isValidAgreementId = !!agreementId && Number.isFinite(numericAgreementId) && numericAgreementId > 0;
  const hasDisputeFilter = !!disputeId && Number.isFinite(numericDisputeId) && numericDisputeId > 0;
  const isAllMode = !agreementId;

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

  const escrowIdUpper = useRef(DEFAULT_ESCROW_ID.toUpperCase()).current;
  const disputeIdUpper = useRef(DEFAULT_DISPUTE_ID.toUpperCase()).current;

  useEffect(() => {
    if (!isValidAgreementId && !isAllMode) {
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const pollEvents = async () => {
      if (cancelled) return;
      try {
        setLoading(true);
        setError(null);

        const latestLedger = await server.getLatestLedger();
        const startLedger = Math.max(1, latestLedger.sequence - LEDGER_LOOKBACK);

        let response: rpc.Api.GetEventsResponse;
        try {
          response = await server.getEvents({
            startLedger,
            filters: [{
              type: 'contract',
              contractIds: [DEFAULT_ESCROW_ID, DEFAULT_DISPUTE_ID],
            }],
            limit: 200,
          });
        } catch (firstErr) {
          console.warn('getEvents failed, retrying with narrower range:', firstErr);
          const narrowStart = Math.max(1, latestLedger.sequence - 2000);
          response = await server.getEvents({
            startLedger: narrowStart,
            filters: [{
              type: 'contract',
              contractIds: [DEFAULT_ESCROW_ID, DEFAULT_DISPUTE_ID],
            }],
            limit: 200,
          });
        }

        if (cancelled) return;

        const decoded = response.events
          .map((event) => {
            const eventContractId = contractIdToString(event.contractId);

            if (!eventContractId) return null;

            const isEscrowEvent = eventContractId === escrowIdUpper;
            const isDisputeEvent = eventContractId === disputeIdUpper;

            if (!isEscrowEvent && !isDisputeEvent) return null;

            const topics = event.topic.map((topic) => {
              try { return scValToNative(topic); } catch { return null; }
            });

            const action = String(topics[0] ?? '');
            const eventId = Number(topics[1] ?? 0);

            if (!isAllMode && isEscrowEvent && eventId !== numericAgreementId) return null;
            if (isDisputeEvent && (!hasDisputeFilter || eventId !== numericDisputeId)) return null;

            let value: unknown = null;
            try { value = scValToNative(event.value); } catch { /* keep null */ }

            return {
              id: event.id,
              ledger: event.ledger,
              type: action,
              message: decodeMessage(action, value),
              timestamp: Date.now() - (latestLedger.sequence - event.ledger) * 5000,
            } satisfies DecodedEvent;
          })
          .filter((d): d is DecodedEvent => d !== null)
          .sort((a, b) => b.ledger - a.ledger);

        console.debug(`[EventStream] Fetched ${response.events.length} events, filtered to ${decoded.length} for escrow=${DEFAULT_ESCROW_ID.slice(0,8)}..., ledger range=${startLedger}-${latestLedger.sequence}`);

        setEvents(decoded);
      } catch (err) {
        console.error('Error fetching agreement event stream:', err);
        setError(String(err instanceof Error ? err.message : err));
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (!cancelled) {
        pollTimer = setTimeout(pollEvents, 8000);
      }
    };

    pollEvents();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [agreementId, disputeId, hasDisputeFilter, isAllMode, isValidAgreementId, numericAgreementId, numericDisputeId, escrowIdUpper, disputeIdUpper]);

  const active = isValidAgreementId || isAllMode;
  return {
    events: active ? events : [],
    loading: active ? loading : false,
    error: active ? error : null,
  };
}
