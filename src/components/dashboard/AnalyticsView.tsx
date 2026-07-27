'use client';

import React from 'react';
import { usePlatformStats } from '@/hooks/useChainQueries';

export default function AnalyticsView() {
  const { data: platformStats, isLoading: loadingPlatform, refetch: refetchPlatform } = usePlatformStats();

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${loadingPlatform ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
          <span className="text-xs text-[#585f6c] font-semibold">{loadingPlatform ? 'Syncing on-chain data…' : 'Live Shared-Contract Data'}</span>
        </div>
        <div className="flex items-center gap-3">
          {platformStats?.lastUpdated && <span className="text-[10px] text-[#747878]">Updated {new Date(platformStats.lastUpdated).toLocaleTimeString()}</span>}
          <button
            onClick={() => refetchPlatform()}
            disabled={loadingPlatform}
            className="text-[10px] font-bold text-[#585f6c] hover:text-black disabled:opacity-40 flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-[#ffffff] p-6 rounded-[24px] border border-[#e2e2e2] shadow-sm">
        <h3 className="text-sm font-bold text-black uppercase tracking-wider mb-6">Shared Escrow Analytics</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#f3f3f3] p-4 rounded-xl border border-[#e2e2e2]">
            <span className="text-[9px] text-[#585f6c] font-bold uppercase tracking-wider">Platform TVL</span>
            <p className="text-lg font-black text-black mt-1">
              {loadingPlatform ? <span className="inline-block w-16 h-5 bg-[#e2e2e2] rounded animate-pulse" /> : <>{platformStats?.tvl ?? '0.00'} XLM</>}
            </p>
            <span className="text-[10px] text-[#585f6c]">Sum of currently locked deposits across all agreements</span>
          </div>

          <div className="bg-[#f3f3f3] p-4 rounded-xl border border-[#e2e2e2]">
            <span className="text-[9px] text-[#585f6c] font-bold uppercase tracking-wider">Active Contracts</span>
            <p className="text-lg font-black text-black mt-1">
              {loadingPlatform ? <span className="inline-block w-8 h-5 bg-[#e2e2e2] rounded animate-pulse" /> : <>{platformStats?.activeContractsCount ?? 0}</>}
            </p>
            <span className="text-[10px] text-[#585f6c]">{platformStats?.resolvedContractsCount ?? 0} resolved agreements on the same shared contract</span>
          </div>

          <div className="bg-[#f3f3f3] p-4 rounded-xl border border-[#e2e2e2]">
            <span className="text-[9px] text-[#585f6c] font-bold uppercase tracking-wider">Disputes Rate</span>
            <p className="text-lg font-black text-black mt-1">
              {loadingPlatform ? <span className="inline-block w-12 h-5 bg-[#e2e2e2] rounded animate-pulse" /> : <>{platformStats?.disputeRate ?? '0.00'}%</>}
            </p>
            <span className="text-[10px] text-[#585f6c]">Share of agreements currently in the dispute lifecycle</span>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-[#e2e2e2]">
          <div>
            <div className="flex justify-between text-xs font-semibold text-black mb-1">
              <span>Deposit Fund Splits (Landlord vs Tenant)</span>
              <span>{platformStats?.depositSplitLandlordPct ?? 0}% / {platformStats?.depositSplitTenantPct ?? 100}%</span>
            </div>
            <div className="w-full bg-[#eeeeee] rounded-full h-3.5 overflow-hidden flex">
              <div className="bg-slate-400 h-full transition-all duration-500" style={{ width: `${platformStats?.depositSplitLandlordPct ?? 0}%` }} />
              <div className="bg-black h-full transition-all duration-500" style={{ width: `${platformStats?.depositSplitTenantPct ?? 100}%` }} />
            </div>
            <p className="text-[9px] text-[#747878] mt-1">Computed from recorded on-chain agreement resolutions across the shared escrow</p>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-black mb-1">
              <span>Shared Contract Footprint</span>
              <span>1 contract / {platformStats?.activeContractsCount ?? 0} active / {platformStats?.resolvedContractsCount ?? 0} resolved</span>
            </div>
            <div className="w-full bg-[#eeeeee] rounded-full h-3.5 overflow-hidden flex">
              <div
                className="bg-black h-full transition-all duration-500"
                style={{
                  width: `${
                    platformStats && platformStats.activeContractsCount + platformStats.resolvedContractsCount > 0
                      ? Math.round((platformStats.activeContractsCount / (platformStats.activeContractsCount + platformStats.resolvedContractsCount)) * 100)
                      : 0
                  }%`,
                }}
              />
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{
                  width: `${
                    platformStats && platformStats.activeContractsCount + platformStats.resolvedContractsCount > 0
                      ? Math.round((platformStats.resolvedContractsCount / (platformStats.activeContractsCount + platformStats.resolvedContractsCount)) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex gap-4 mt-1">
              <span className="text-[9px] text-black font-semibold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-black inline-block" />Active</span>
              <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Resolved</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#ffffff] p-6 rounded-[24px] border border-[#e2e2e2] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold text-black uppercase tracking-wider">Deposit Activity (last ~3.5 days)</h4>
          <span className="text-[9px] text-[#747878]">Bucketed from agreement funded timestamps</span>
        </div>
        <div className="h-40 bg-[#f3f3f3] rounded-xl flex items-end justify-between px-4 pb-3 pt-4 border border-[#e2e2e2]">
          {(platformStats?.tvlHistory ?? []).map((bucket, index, list) => (
            <div key={index} className="flex flex-col items-center gap-1 flex-1">
              <span className="text-[8px] text-[#585f6c] font-mono">{bucket.amountXlm > 0 ? `${bucket.amountXlm.toFixed(0)} XLM` : ''}</span>
              <div
                className="w-8 rounded-t transition-all duration-700"
                style={{
                  height: `${bucket.pct}%`,
                  backgroundColor: index === list.length - 1 ? '#000000' : `rgba(0,0,0,${0.12 + index * 0.18})`,
                }}
              />
              <span className={`text-[8px] font-semibold ${index === list.length - 1 ? 'text-black' : 'text-[#585f6c]'}`}>{bucket.label}</span>
            </div>
          ))}
        </div>
        {platformStats?.tvlHistory?.every((bucket) => bucket.amountXlm === 0) && (
          <p className="text-[10px] text-[#747878] text-center mt-2">No newly funded agreements were detected in the last ~3.5 days.</p>
        )}
      </div>
    </div>
  );
}
