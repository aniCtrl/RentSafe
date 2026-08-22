'use client';

import { useEffect, useState } from 'react';
import { scValToNative, rpc, Contract } from '@stellar/stellar-sdk';
import { DEFAULT_DISPUTE_ID, DEFAULT_ESCROW_ID, server } from '@/lib/stellar';
import { formatStroopsToXlm, shortAddress } from '@/lib/rentsafe';

export interface DecodedEvent {
  id: string;
  ledger: number;
  type: string;
  message: string;
  timestamp: number;
  contractId: string;
  agreementId?: number;
  disputeId?: number;
  txHash?: string;
  actor?: string;
  actorAddresses: string[];
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
const EVENT_PAGE_LIMIT = 200;
const MAX_EVENT_PAGES = 25;
const MAX_CACHED_EVENTS = 500;
const EVENT_CACHE_KEY = `rentsafe-activity-events:${DEFAULT_ESCROW_ID.toUpperCase()}:${DEFAULT_DISPUTE_ID.toUpperCase()}`;

function readCachedEvents(): DecodedEvent[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(EVENT_CACHE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((event): event is DecodedEvent => (
      Boolean(event)
      && typeof event === 'object'
      && typeof (event as DecodedEvent).id === 'string'
      && typeof (event as DecodedEvent).ledger === 'number'
      && typeof (event as DecodedEvent).type === 'string'
      && typeof (event as DecodedEvent).message === 'string'
      && typeof (event as DecodedEvent).timestamp === 'number'
      && Array.isArray((event as DecodedEvent).actorAddresses)
    )).sort((a, b) => b.ledger - a.ledger).slice(0, MAX_CACHED_EVENTS);
  } catch (error) {
    console.warn('Unable to restore cached agreement activity:', error);
    return [];
  }
}

function writeCachedEvents(events: DecodedEvent[]) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(EVENT_CACHE_KEY, JSON.stringify(
      events.slice().sort((a, b) => b.ledger - a.ledger).slice(0, MAX_CACHED_EVENTS),
    ));
  } catch (error) {
    console.warn('Unable to persist agreement activity:', error);
  }
}

function mergeEvents(...eventLists: DecodedEvent[][]): DecodedEvent[] {
  const byId = new Map<string, DecodedEvent>();
  eventLists.flat().forEach((event) => {
    const existing = byId.get(event.id);
    byId.set(event.id, existing ? {
      ...existing,
      ...event,
      actorAddresses: Array.from(new Set([...existing.actorAddresses, ...event.actorAddresses])),
    } : event);
  });
  return Array.from(byId.values()).sort((a, b) => b.ledger - a.ledger);
}

export function filterVisibleEvents(events: DecodedEvent[], isAllMode: boolean, isValidAgreementId: boolean, numericAgreementId: number, hasDisputeFilter: boolean, numericDisputeId: number) {
  return events.filter((event) => {
    // Agreement activity remains the primary scope. When an agreement has a
    // dispute, include dispute-contract events as well, even when enrichment
    // has not yet mapped them back to the agreement.
    if (!isAllMode && isValidAgreementId) {
      return event.agreementId === numericAgreementId
        || (hasDisputeFilter && event.disputeId === numericDisputeId);
    }
    if (hasDisputeFilter && event.disputeId !== numericDisputeId) return false;
    return true;
  });
}

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
      case 'mutual_resolution_proposed':
        return `Mutual settlement proposed: ${formatStroopsToXlm(asStroopsLike(parts[1]))} XLM to landlord, ${formatStroopsToXlm(asStroopsLike(parts[2]))} XLM to tenant`;
      case 'settlement_proposal_created':
        return `Settlement proposal created by ${shortAddress(String(parts[0] ?? ''))}: ${formatStroopsToXlm(asStroopsLike(parts[1]))} XLM to landlord, ${formatStroopsToXlm(asStroopsLike(parts[2]))} XLM to tenant`;
      case 'settlement_proposal_rejected':
        return `Settlement proposal rejected by ${shortAddress(String(parts[0] ?? ''))}`;
      case 'settlement_proposal_countered':
        return `Counter-offer created by ${shortAddress(String(parts[0] ?? ''))}: ${formatStroopsToXlm(asStroopsLike(parts[2]))} XLM to landlord, ${formatStroopsToXlm(asStroopsLike(parts[3]))} XLM to tenant`;
      case 'settlement_proposal_accepted':
        return `Settlement proposal accepted: ${formatStroopsToXlm(asStroopsLike(parts[1]))} XLM to landlord, ${formatStroopsToXlm(asStroopsLike(parts[2]))} XLM to tenant`;
      default:
        return 'Agreement activity detected on-chain';
    }
  };

  const escrowIdUpper = DEFAULT_ESCROW_ID.toUpperCase();
  const disputeIdUpper = DEFAULT_DISPUTE_ID.toUpperCase();

  useEffect(() => {
    if (!isValidAgreementId && !isAllMode) {
      return;
    }

    let cachedEvents = readCachedEvents();
    if (cachedEvents.length > 0) {
      setEvents(filterVisibleEvents(cachedEvents, isAllMode, isValidAgreementId, numericAgreementId, hasDisputeFilter, numericDisputeId));
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
        const filters = [{
          type: 'contract' as const,
          contractIds: [DEFAULT_ESCROW_ID, DEFAULT_DISPUTE_ID],
        }];
        const fetchPages = async (firstPage: rpc.Api.GetEventsResponse) => {
          const allEvents = [...firstPage.events];
          let cursor = firstPage.cursor;

          for (let page = 1; cursor && page < MAX_EVENT_PAGES; page += 1) {
            const nextPage = await server.getEvents({ cursor, filters, limit: EVENT_PAGE_LIMIT });
            allEvents.push(...nextPage.events);
            if (!nextPage.cursor || nextPage.cursor === cursor || nextPage.events.length === 0) break;
            cursor = nextPage.cursor;
          }

          return { ...firstPage, events: allEvents };
        };

        const fetchFromLedger = async (startLedger: number) => fetchPages(await server.getEvents({
          startLedger,
          filters,
          limit: EVENT_PAGE_LIMIT,
        }));

        try {
          response = await fetchFromLedger(startLedger);
        } catch (firstErr) {
          console.warn('getEvents failed, retrying with narrower range:', firstErr);
          const narrowStart = Math.max(1, latestLedger.sequence - 2000);
          response = await fetchFromLedger(narrowStart);
        }

        // On the first visit, backfill from the oldest ledger retained by the
        // RPC node so activity from agreements created before this session is
        // available and can be cached for future visits.
        if (cachedEvents.length === 0 && response.oldestLedger < startLedger) {
          try {
            response = await fetchFromLedger(response.oldestLedger);
          } catch (historyError) {
            console.warn('Unable to backfill older agreement activity:', historyError);
          }
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

            let value: unknown = null;
            try { value = scValToNative(event.value); } catch { /* keep null */ }

            const valueParts = asTuple(value);
            const resolvedAgreementId = isEscrowEvent
              ? eventId
              : ['dispute_registered', 'dispute_resolved'].includes(action)
                ? Number(valueParts[0] ?? 0)
                : undefined;
            const resolvedDisputeId = isDisputeEvent
              ? eventId
              : action === 'dispute_raised'
                ? Number(valueParts[0] ?? 0)
                : undefined;
            const actorIndexes = isEscrowEvent
              ? ({
                  agreement_created: [0, 1],
                  deposit_locked: [0],
                  agreement_active: [0, 1],
                  refund_requested: [0],
                  deduction_requested: [0],
                  deduction_accepted: [0],
                  deduction_rejected: [0],
                  dispute_raised: [1],
                }[action] ?? [])
              : ({
                  dispute_registered: [1],
                  evidence_submitted: [0],
                  mutual_resolution_proposed: [0],
                  settlement_proposal_created: [0],
                  settlement_proposal_rejected: [0, 1],
                  settlement_proposal_countered: [0],
                  settlement_proposal_accepted: [0],
                }[action] ?? []);
            const actorCandidates = actorIndexes
              .map((index) => valueParts[index])
              .filter((part) => typeof part === 'string' && part.length > 0)
              .map(String);

            const decodedEvent: DecodedEvent = {
              id: event.id,
              ledger: event.ledger,
              type: action,
              message: decodeMessage(action, value),
              timestamp: (() => {
                const ledgerTimestamp = Date.parse(event.ledgerClosedAt);
                return Number.isFinite(ledgerTimestamp)
                  ? ledgerTimestamp
                  : Date.now() - (latestLedger.sequence - event.ledger) * 5000;
              })(),
              contractId: eventContractId,
              agreementId: resolvedAgreementId && resolvedAgreementId > 0 ? resolvedAgreementId : undefined,
              disputeId: resolvedDisputeId && resolvedDisputeId > 0 ? resolvedDisputeId : undefined,
              txHash: event.txHash || undefined,
              actor: actorCandidates[0],
              actorAddresses: actorCandidates,
            };
            return decodedEvent;
          })
          .filter((d): d is DecodedEvent => d !== null);

        // Most escrow events identify only the actor who submitted the action.
        // Build a small in-memory relationship map from the creation and
        // registration events so counterparties receive the same lifecycle
        // notification without changing the contract event format.
        const merged = mergeEvents(cachedEvents, decoded);
        const participantsByAgreement = new Map<number, string[]>();
        const agreementByDispute = new Map<number, number>();
        merged.forEach((event) => {
          if (event.type === 'agreement_created' && event.agreementId && event.actorAddresses.length > 0) {
            participantsByAgreement.set(event.agreementId, event.actorAddresses);
          }
          if (event.type === 'dispute_registered' && event.disputeId && event.agreementId) {
            agreementByDispute.set(event.disputeId, event.agreementId);
          }
        });

        const enriched = merged
          .map((event) => {
            const agreementId = event.agreementId ?? (event.disputeId ? agreementByDispute.get(event.disputeId) : undefined);
            const participants = agreementId ? participantsByAgreement.get(agreementId) ?? [] : [];
            return {
              ...event,
              agreementId,
              actorAddresses: Array.from(new Set([...event.actorAddresses, ...participants])),
            };
          })
          .sort((a, b) => b.ledger - a.ledger);

        writeCachedEvents(enriched);
        cachedEvents = enriched;
        const visibleEvents = filterVisibleEvents(enriched, isAllMode, isValidAgreementId, numericAgreementId, hasDisputeFilter, numericDisputeId);

        console.debug(`[EventStream] Fetched ${response.events.length} events, showing ${visibleEvents.length} with ${enriched.length} cached for escrow=${DEFAULT_ESCROW_ID.slice(0, 8)}..., ledger range=${startLedger}-${latestLedger.sequence}`);

        setEvents(visibleEvents);
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
