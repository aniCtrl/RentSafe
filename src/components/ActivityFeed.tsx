'use client';

import React from 'react';
import { useEventStream } from '@/hooks/useEventStream';
import { useAppStore } from '@/store/useAppStore';

export default function ActivityFeed() {
  const { escrowId } = useAppStore();
  const { events, loading } = useEventStream(escrowId);

  const getIcon = (type: string) => {
    switch (type) {
      case 'init':
        return 'assignment_turned_in';
      case 'funded':
        return 'lock_open';
      case 'active':
        return 'lock';
      case 'set_prop':
        return 'request_quote';
      case 'set_acc':
      case 'resolved':
        return 'done_all';
      case 'disputed':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'disputed':
        return 'bg-[#ffdad6] text-[#ba1a1a]';
      case 'set_prop':
        return 'bg-[#dce2f3] text-[#5e6572]';
      case 'set_acc':
      case 'resolved':
        return 'bg-emerald-100 text-emerald-800';
      case 'funded':
      case 'active':
      case 'init':
        return 'bg-[#eeeeee] text-black';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="bg-[#ffffff] rounded-[24px] p-6 border border-[#e2e2e2] shadow-sm">
      <div className="flex justify-between items-center mb-6 border-b border-[#e2e2e2] pb-3">
        <h4 className="text-sm font-bold text-[#000000] flex items-center gap-1.5">
          <span className="material-symbols-outlined text-lg">history</span>
          <span>Live Agreement Activity</span>
        </h4>
        {loading && (
          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8 text-xs text-[#585f6c]">
          No events detected on-chain yet for this agreement.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6">
          {/* Vertical connecting line */}
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#c4c7c7]/50"></div>

          {events.map((evt) => (
            <div key={evt.id} className="relative flex items-start gap-4 text-xs">
              
              {/* Event bullet icon */}
              <div className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#ffffff] z-10 ${getIconColor(evt.type)}`}>
                <span className="material-symbols-outlined text-[10px] font-bold">
                  {getIcon(evt.type)}
                </span>
              </div>

              <div className="flex-grow">
                <p className="font-semibold text-black leading-relaxed">{evt.message}</p>
                <p className="text-[10px] text-[#585f6c] mt-1 flex items-center gap-1.5">
                  <span>Ledger: {evt.ledger}</span>
                  <span>•</span>
                  <span>{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
