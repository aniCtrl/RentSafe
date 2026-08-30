'use client';

import React from 'react';
import Link from 'next/link';
import { useEventStream } from '@/hooks/useEventStream';
import CopyHashButton from '@/components/CopyHashButton';

interface ActivityFeedProps {
  agreementId?: string | number | null;
  disputeId?: string | number | null;
  className?: string;
  maxHeightClass?: string;
}

export default function ActivityFeed({
  agreementId,
  disputeId,
  className = '',
  maxHeightClass = 'min-h-[440px] max-h-[580px]',
}: ActivityFeedProps) {
  const { events, loading, error } = useEventStream(agreementId, disputeId);

  const getIcon = (type: string) => {
    switch (type) {
      case 'agreement_created':
        return 'assignment_turned_in';
      case 'deposit_locked':
        return 'lock';
      case 'agreement_active':
        return 'home';
      case 'refund_requested':
        return 'reply';
      case 'deduction_requested':
        return 'request_quote';
      case 'deduction_accepted':
      case 'settled':
        return 'done_all';
      case 'deduction_rejected':
      case 'dispute_raised':
        return 'warning';
      case 'dispute_resolved':
        return 'gavel';
      case 'evidence_submitted':
        return 'attach_file';
      default:
        return 'info';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'dispute_raised':
      case 'deduction_rejected':
        return 'bg-[#ffdad6] text-[#ba1a1a] border-[#ffb4ab]';
      case 'deduction_requested':
      case 'refund_requested':
        return 'bg-[#dce2f3] text-[#5e6572] border-[#b0b8c8]';
      case 'deduction_accepted':
      case 'settled':
      case 'dispute_resolved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'evidence_submitted':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      default:
        return 'bg-[#f0f4f8] text-slate-700 border-slate-300';
    }
  };

  return (
    <div className={`surface-card rounded-[24px] p-6 md:p-7 border border-[#e2e2e2] shadow-sm flex flex-col justify-between ${className}`}>
      <div>
        <div className="flex justify-between items-center mb-5 border-b border-[#e2e2e2] pb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-black">history</span>
            <h4 className="text-base font-extrabold text-black">Live Agreement Activity</h4>
            {events.length > 0 && (
              <span className="ml-1.5 bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {events.length}
              </span>
            )}
          </div>
          {loading && <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>}
        </div>

        {error && events.length === 0 ? (
          <div className="text-center py-14 text-xs">
            <p className="text-[#ba1a1a] font-semibold mb-1 text-sm">Failed to load events</p>
            <p className="text-[#585f6c] break-all max-w-md mx-auto">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-14 text-xs text-[#585f6c]">
            <span className="material-symbols-outlined text-3xl mb-2 text-slate-400">graphic_eq</span>
            <p className="font-medium text-sm text-slate-700">No events detected yet</p>
            <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
              {agreementId ? 'No events detected on-chain yet for this agreement.' : 'No on-chain events detected yet across your agreements.'}
            </p>
          </div>
        ) : (
          <>
            {error && (
              <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 flex items-center gap-2" role="status">
                <span className="material-symbols-outlined text-sm shrink-0">warning</span>
                <span>Live refresh is unavailable. Showing saved activity from this device.</span>
              </p>
            )}
            <div className={`${maxHeightClass} overflow-y-auto pr-2 space-y-3.5`}>
              {events.map((event) => (
                <div key={event.id} className="relative flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/70 hover:bg-slate-100/60 hover:border-slate-300 transition-all text-xs">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shrink-0 ${getIconColor(event.type)}`}>
                    <span className="material-symbols-outlined text-xs font-bold">{getIcon(event.type)}</span>
                  </div>

                  <div className="flex-grow min-w-0">
                    <p className="font-semibold text-slate-900 text-xs leading-snug">
                      {event.agreementId && !agreementId ? (
                        <Link className="hover:underline text-black" href={`/inspect-escrow/${event.agreementId}`}>
                          {event.message}
                        </Link>
                      ) : (
                        event.message
                      )}
                    </p>
                    <div className="text-[11px] text-[#585f6c] mt-2 flex flex-wrap items-center gap-2 font-mono">
                      <span className="bg-slate-200/60 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Ledger #{event.ledger}</span>
                      {event.txHash && (
                        <>
                          <span>•</span>
                          <a className="underline font-sans font-semibold text-slate-800 hover:text-black" href={`https://stellar.expert/explorer/testnet/tx/${event.txHash}`} target="_blank" rel="noreferrer">
                            Transaction
                          </a>
                          <CopyHashButton hash={event.txHash} compact />
                        </>
                      )}
                      <span>•</span>
                      <span className="font-sans text-slate-500">
                        {new Date(event.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
