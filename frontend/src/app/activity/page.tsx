'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStellar } from '../../hooks/useStellar';
import { SorobanEventData } from '../../services/stellar';
import { 
  FileText, 
  Lock, 
  HelpCircle, 
  CheckCircle, 
  ShieldAlert, 
  Activity, 
  ExternalLink,
  RefreshCw,
  Clock
} from 'lucide-react';

export default function ActivityFeed() {
  const service = useStellar();
  const [startLedger, setStartLedger] = useState<number>(0);

  // Initialize start ledger sequence
  useEffect(() => {
    const fetchSeq = async () => {
      const latest = await service.getLatestLedger();
      // Look back ~10000 ledgers (~12 hours) on mount to show history
      setStartLedger(Math.max(1, latest - 10000));
    };
    fetchSeq();
  }, [service]);

  const { data: events = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['contract-events', service.getConfig().escrow, startLedger],
    queryFn: async () => {
      if (startLedger === 0) return [];
      return service.getEvents(startLedger);
    },
    enabled: startLedger > 0,
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'agreement_created':
        return <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center"><FileText className="h-4.5 w-4.5" /></div>;
      case 'deposit_locked':
        return <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center"><Lock className="h-4.5 w-4.5" /></div>;
      case 'deduction_proposed':
        return <div className="h-9 w-9 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center"><HelpCircle className="h-4.5 w-4.5" /></div>;
      case 'deduction_approved':
      case 'dispute_resolved':
      case 'dispute_resolved_admin':
        return <div className="h-9 w-9 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center"><CheckCircle className="h-4.5 w-4.5" /></div>;
      case 'dispute_raised':
      case 'dispute_registered':
        return <div className="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center"><ShieldAlert className="h-4.5 w-4.5" /></div>;
      default:
        return <div className="h-9 w-9 rounded-xl bg-slate-500/10 text-slate-400 flex items-center justify-center"><Activity className="h-4.5 w-4.5" /></div>;
    }
  };

  const formatEventText = (event: SorobanEventData) => {
    const d = event.details;
    switch (event.type) {
      case 'agreement_created':
        return (
          <span>
            Rental agreement <strong className="text-white font-bold">#{event.agreementId}</strong> was created for <strong className="text-indigo-400 font-semibold">{d.amount} XLM</strong>. Landlord: <code className="text-[11px] bg-slate-950 px-1 py-0.5 rounded font-mono">{d.landlord?.substring(0,6)}...</code>, Tenant: <code className="text-[11px] bg-slate-950 px-1 py-0.5 rounded font-mono">{d.tenant?.substring(0,6)}...</code>
          </span>
        );
      case 'deposit_locked':
        return (
          <span>
            Security deposit of <strong className="text-white font-bold">{d.amount} XLM</strong> for agreement <strong className="text-white font-bold">#{event.agreementId}</strong> was successfully locked on-chain by the tenant.
          </span>
        );
      case 'deduction_proposed':
        return (
          <span>
            Landlord proposed a deduction split for agreement <strong className="text-white font-bold">#{event.agreementId}</strong>: <strong className="text-rose-400 font-bold">{d.landlordAmount} XLM</strong> to landlord, <strong className="text-green-400 font-bold">{d.tenantAmount} XLM</strong> refunded to tenant.
          </span>
        );
      case 'deduction_approved':
        return (
          <span>
            Tenant approved refund split for agreement <strong className="text-white font-bold">#{event.agreementId}</strong>. Escrow resolved with <strong className="text-indigo-400 font-bold">{d.tenantAmount} XLM</strong> refunded to tenant.
          </span>
        );
      case 'dispute_raised':
        return (
          <span>
            Dispute <strong className="text-white font-bold">#{d.disputeId}</strong> raised on agreement <strong className="text-white font-bold">#{event.agreementId}</strong>. Escalated to the arbiter contract. Reason: <span className="text-slate-300 italic">"{d.reason}"</span>.
          </span>
        );
      case 'dispute_registered':
        return (
          <span>
            Arbiter Dispute registered for agreement <strong className="text-white font-bold">#{d.agreementId}</strong>. Amount contested: <strong className="text-white font-bold">{d.amount} XLM</strong>. Reason: <span className="text-slate-300 italic">"{d.reason}"</span>.
          </span>
        );
      case 'dispute_resolved_admin':
        return (
          <span>
            Arbiter executed resolution split on dispute <strong className="text-white font-bold">#{event.agreementId}</strong>. Distributed <strong className="text-rose-400 font-bold">{d.landlordAmount} XLM</strong> to landlord, and <strong className="text-green-400 font-bold">{d.tenantAmount} XLM</strong> to tenant.
          </span>
        );
      default:
        return <span>Unknown blockchain event detected on-chain.</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-white tracking-tight">On-Chain Event Ledger</h2>
          <p className="text-slate-400 text-xs font-medium">Real-time polling of events emitted by the RentSafe escrow smart contracts.</p>
        </div>

        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 self-start sm:self-center px-4 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh Feed
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-500 font-medium">Listening to Stellar RPC stream...</div>
      ) : events.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-850 p-12 rounded-3xl text-center text-slate-500">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">No recent events emitted by the contracts</p>
          <p className="text-xs text-slate-600 mt-1.5">Events will appear here automatically when contracts are initialized or agreements change state.</p>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-850 rounded-2xl divide-y divide-slate-850/60 overflow-hidden">
          {events.map((e) => (
            <div key={e.id} className="p-5 flex items-start gap-4 hover:bg-slate-900/60 transition-colors duration-200">
              {getEventIcon(e.type)}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">{e.type.replace(/_/g, ' ')}</span>
                  <span className="text-slate-500 font-medium">Ledger #{e.ledger}</span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed font-medium">
                  {formatEventText(e)}
                </p>
                <div className="flex items-center gap-2.5 pt-1">
                  <a 
                    href={`https://stellar.expert/explorer/testnet/ledger/${e.ledger}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline font-semibold"
                  >
                    View Ledger
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
