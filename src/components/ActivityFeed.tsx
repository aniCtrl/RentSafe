'use client';

import React from 'react';
import Link from 'next/link';
import { useEventStream } from '@/hooks/useEventStream';
import { useAppStore } from '@/store/useAppStore';
import CopyHashButton from '@/components/CopyHashButton';

export default function ActivityFeed({ agreementId, disputeId }: { agreementId?: string | number | null; disputeId?: string | number | null }) {
  const { events, loading, error } = useEventStream(agreementId, disputeId);
  const notifications = useAppStore((state) => state.notifications);
  const visibleNotifications = notifications
    .filter((notification) => !agreementId || notification.agreementId === String(agreementId))
    .slice(0, 8);

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
        return 'bg-[#ffdad6] text-[#ba1a1a]';
      case 'deduction_requested':
      case 'refund_requested':
        return 'bg-[#dce2f3] text-[#5e6572]';
      case 'deduction_accepted':
      case 'settled':
      case 'dispute_resolved':
        return 'bg-emerald-100 text-emerald-800';
      case 'evidence_submitted':
        return 'bg-sky-100 text-sky-800';
      default:
        return 'bg-[#eeeeee] text-black';
    }
  };

  return (
    <div className="surface-card rounded-[24px] p-6 border shadow-sm">
      <div className="flex justify-between items-center mb-6 border-b border-[#e2e2e2] pb-3">
        <h4 className="text-sm font-bold text-[#000000] flex items-center gap-1.5">
          <span className="material-symbols-outlined text-lg">history</span>
          <span>Live Agreement Activity</span>
        </h4>
        {loading && <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>}
      </div>

      {error ? (
        <div className="text-center py-8 text-xs">
          <p className="text-[#ba1a1a] font-medium mb-1">Failed to load events</p>
          <p className="text-[#585f6c] break-all">{error}</p>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 text-xs text-[#585f6c]">
          {agreementId ? 'No events detected on-chain yet for this agreement.' : 'No on-chain events detected yet across your agreements.'}
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto pr-2">
          <div className="relative pl-6 space-y-6">
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#c4c7c7]/50"></div>

            {events.map((event) => (
              <div key={event.id} className="relative flex items-start gap-4 text-xs">
                <div className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#ffffff] z-10 ${getIconColor(event.type)}`}>
                  <span className="material-symbols-outlined text-[10px] font-bold">{getIcon(event.type)}</span>
                </div>

                <div className="flex-grow">
                  <p className="font-semibold text-black leading-relaxed">
                    {event.agreementId && !agreementId ? <Link className="hover:underline" href={`/inspect-escrow/${event.agreementId}`}>{event.message}</Link> : event.message}
                  </p>
                  <p className="text-[10px] text-[#585f6c] mt-1 flex items-center gap-1.5">
                    <span>Ledger: {event.ledger}</span>
                    {event.txHash && (
                      <>
                        <span>•</span>
                        <a className="underline" href={`https://stellar.expert/explorer/testnet/tx/${event.txHash}`} target="_blank" rel="noreferrer">Transaction</a>
                        <CopyHashButton hash={event.txHash} compact />
                      </>
                    )}
                    <span>•</span>
                    <span>
                      {new Date(event.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {visibleNotifications.length > 0 && (
        <div className="mt-6 border-t border-[#e2e2e2] pt-4" aria-label="Wallet notification history">
          <div className="mb-3 flex items-center justify-between">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-[#585f6c]">Wallet notifications</h5>
            <Link href="/activity-feed" className="text-[10px] font-bold text-[#276c9f] hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {visibleNotifications.map((notification) => (
              <Link key={notification.id} href={notification.href ?? '/activity-feed'} className="flex items-start gap-2 rounded-xl bg-[#f3f3f3] p-3 hover:bg-[#eeeeee]">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.severity === 'error' ? 'bg-[#ba1a1a]' : notification.severity === 'warning' ? 'bg-amber-500' : notification.severity === 'success' ? 'bg-emerald-500' : 'bg-sky-500'}`} />
                <span className="min-w-0"><span className="block text-xs font-semibold text-black">{notification.title}</span><span className="block truncate text-[10px] text-[#585f6c]">{notification.message}</span></span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
