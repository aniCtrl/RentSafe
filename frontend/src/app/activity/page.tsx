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
    refetchInterval: 5000,
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'agreement_created':
        return <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center"><FileText className="h-4.5 w-4.5" /></div>;
      case 'deposit_locked':
        return <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center"><Lock className="h-4.5 w-4.5" /></div>;
      case 'deduction_proposed':
        return <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center"><HelpCircle className="h-4.5 w-4.5" /></div>;
      case 'deduction_approved':
      case 'dispute_resolved':
      case 'dispute_resolved_admin':
        return <div className="h-9 w-9 rounded-xl bg-green-50 text-[#1b8b3a] border border-green-100 flex items-center justify-center"><CheckCircle className="h-4.5 w-4.5" /></div>;
      case 'dispute_raised':
      case 'dispute_registered':
        return <div className="h-9 w-9 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center"><ShieldAlert className="h-4.5 w-4.5" /></div>;
      default:
        return <div className="h-9 w-9 rounded-xl bg-slate-50 text-slate-600 border border-slate-100 flex items-center justify-center"><Activity className="h-4.5 w-4.5" /></div>;
    }
  };

  const formatEventText = (event: SorobanEventData) => {
    const d = event.details;
    switch (event.type) {
      case 'agreement_created':
        return (
          <span>
            Rental agreement <strong className="text-slate-800 font-bold">#{event.agreementId}</strong> was created for <strong className="text-[#1b8b3a] font-semibold">{d.amount} XLM</strong>. Landlord: <code className="text-[11px] bg-[#f4f6f6] px-1 py-0.5 rounded font-mono text-slate-600">{d.landlord?.substring(0,6)}...</code>, Tenant: <code className="text-[11px] bg-[#f4f6f6] px-1 py-0.5 rounded font-mono text-slate-600">{d.tenant?.substring(0,6)}...</code>
          </span>
        );
      case 'deposit_locked':
        return (
          <span>
            Security deposit of <strong className="text-slate-800 font-bold">{d.amount} XLM</strong> for agreement <strong className="text-slate-800 font-bold">#{event.agreementId}</strong> was successfully locked on-chain by the tenant.
          </span>
        );
      case 'deduction_proposed':
        return (
          <span>
            Landlord proposed a deduction split for agreement <strong className="text-slate-800 font-bold">#{event.agreementId}</strong>: <strong className="text-red-600 font-bold">{d.landlordAmount} XLM</strong> to landlord, and <strong className="text-[#1b8b3a] font-bold">{d.tenantAmount} XLM</strong> refunded to tenant.
          </span>
        );
      case 'deduction_approved':
        return (
          <span>
            Tenant approved refund split for agreement <strong className="text-slate-800 font-bold">#{event.agreementId}</strong>. Escrow resolved with <strong className="text-[#1b8b3a] font-bold">{d.tenantAmount} XLM</strong> refunded to tenant.
          </span>
        );
      case 'dispute_raised':
        return (
          <span>
            Dispute <strong className="text-slate-800 font-bold">#{d.disputeId}</strong> raised on agreement <strong className="text-slate-800 font-bold">#{event.agreementId}</strong>. Escalated to the arbiter contract. Reason: <span className="text-slate-500 italic">"{d.reason}"</span>.
          </span>
        );
      case 'dispute_registered':
        return (
          <span>
            Arbiter Dispute registered for agreement <strong className="text-slate-800 font-bold">#{d.agreementId}</strong>. Amount contested: <strong className="text-slate-800 font-bold">{d.amount} XLM</strong>. Reason: <span className="text-slate-500 italic">"{d.reason}"</span>.
          </span>
        );
      case 'dispute_resolved_admin':
        return (
          <span>
            Arbiter executed resolution split on dispute <strong className="text-slate-800 font-bold">#{event.agreementId}</strong>. Distributed <strong className="text-red-600 font-bold">{d.landlordAmount} XLM</strong> to landlord, and <strong className="text-[#1b8b3a] font-bold">{d.tenantAmount} XLM</strong> to tenant.
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
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">On-Chain Event Ledger</h2>
          <p className="text-slate-400 text-xs font-semibold">Real-time polling of events emitted by the RentSafe escrow smart contracts.</p>
        </div>

        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 self-start sm:self-center px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh Feed
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-400 font-medium text-sm">Listening to Stellar RPC stream...</div>
      ) : events.length === 0 ? (
        <div className="bg-white border border-slate-200/60 p-12 rounded-3xl text-center text-slate-400">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-30 text-slate-350" />
          <p className="text-sm font-semibold">No recent events emitted by the contracts</p>
          <p className="text-xs text-slate-500 mt-1.5">Events will appear here automatically when contracts are initialized or agreements change state.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          {events.map((e) => (
            <div key={e.id} className="p-5 flex items-start gap-4 hover:bg-slate-50/50 transition-colors duration-200">
              {getEventIcon(e.type)}
              <div className="flex-1 space-y-2 text-slate-700">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">{e.type.replace(/_/g, ' ')}</span>
                  <span className="text-slate-400 font-medium">Ledger #{e.ledger}</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed font-semibold">
                  {formatEventText(e)}
                </p>
                <div className="flex items-center gap-2.5 pt-1">
                  <a 
                    href={`https://stellar.expert/explorer/testnet/ledger/${e.ledger}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-[#1b8b3a] hover:text-[#156c2d] hover:underline font-bold"
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
