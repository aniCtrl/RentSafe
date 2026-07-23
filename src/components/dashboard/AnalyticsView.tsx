'use client';

import React, { useState } from 'react';
import { usePlatformStats } from '@/hooks/useChainQueries';
import type { TvlBucket } from '@/services/chain/agreementService';

function formatTimeRange(from: number, to: number) {
  if (!from || !to || Number.isNaN(from) || Number.isNaN(to)) {
    return 'N/A';
  }
  const fromDate = new Date(from * 1000);
  const toDate = new Date(to * 1000);
  const diffSeconds = to - from;

  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  const dateOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

  // If it's a daily bucket (approximately >= 23 hours)
  if (diffSeconds >= 23 * 3600) {
    const fromStr = fromDate.toLocaleDateString([], dateOpts);
    const toStr = toDate.toLocaleDateString([], dateOpts);
    return fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`;
  }

  // If it's within a single day and doesn't cross midnight
  if (fromDate.toDateString() === toDate.toDateString()) {
    return `${fromDate.toLocaleTimeString([], timeOpts)} – ${toDate.toLocaleTimeString([], timeOpts)}`;
  }

  // If it crosses midnight
  const fromStr = `${fromDate.toLocaleDateString([], dateOpts)}, ${fromDate.toLocaleTimeString([], timeOpts)}`;
  const toStr = `${toDate.toLocaleDateString([], dateOpts)}, ${toDate.toLocaleTimeString([], timeOpts)}`;
  return `${fromStr} – ${toStr}`;
}

function DepositBar({ bucket, maxPct, index, total }: { bucket: TvlBucket; maxPct: number; index: number; total: number }) {
  const [hovered, setHovered] = useState(false);
  const hasData = bucket.amountXlm > 0;

  const gradient = 'linear-gradient(180deg, #2c2c2c 0%, #000000 100%)';

  // Scale the bar height to max 80% to leave room for the amount label at the top of the column
  const barHeight = hasData ? `${Math.max(bucket.pct * 0.8, 6)}%` : '4px';

  return (
    <div
      className="flex-1 h-full flex flex-col justify-end items-center relative group px-1 rounded-lg transition-colors hover:bg-black/[0.04]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tooltip */}
      {hovered && (
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white text-[10px] rounded-xl px-3 py-2 shadow-xl whitespace-nowrap pointer-events-none border border-slate-800 animate-fadeIn">
          <p className="font-bold text-neutral-300">{bucket.amountXlm.toFixed(2)} XLM</p>
          <p className="text-white/80 font-medium">{bucket.count} agreement{bucket.count !== 1 ? 's' : ''} funded</p>
          <p className="text-white/50 text-[9px]">{formatTimeRange(bucket.fromTimestamp, bucket.toTimestamp)}</p>
        </div>
      )}

      {/* Amount label (above the bar) */}
      {hasData && (
        <span className="text-[9px] text-[#000000] font-bold mb-1 select-none">
          {bucket.amountXlm.toFixed(0)} XLM
        </span>
      )}

      {/* The Bar */}
      <div
        className={`w-8 rounded-t-md transition-all duration-500 ease-out ${
          hasData 
            ? 'shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:brightness-110' 
            : 'bg-slate-300/70 border-t border-slate-400/30 rounded-sm'
        }`}
        style={{
          height: barHeight,
          background: hasData ? gradient : undefined,
        }}
      />
    </div>
  );
}

export default function AnalyticsView() {
  const { data: platformStats, isLoading: loadingPlatform, refetch: refetchPlatform } = usePlatformStats();
  const tvlHistory = platformStats?.tvlHistory ?? [];
  const maxPct = Math.max(...tvlHistory.map((b) => b.pct), 0);
  const maxAmountXlm = Math.max(...tvlHistory.map((b) => b.amountXlm), 0);
  const displayMax = maxAmountXlm > 0 ? maxAmountXlm : 10;

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
            <span className="text-[9px] text-[#585f6c] font-bold uppercase tracking-wider">Agreements</span>
            <p className="text-lg font-black text-black mt-1">
              {loadingPlatform ? <span className="inline-block w-8 h-5 bg-[#e2e2e2] rounded animate-pulse" /> : <><span className="text-[#2c2c2c]">{platformStats?.activeContractsCount ?? 0}</span>&nbsp;/&nbsp;<span className="text-emerald-600">{platformStats?.resolvedContractsCount ?? 0}</span></>}
            </p>
            <span className="text-[10px] text-[#585f6c]">
              <span className="inline-flex items-center gap-1 mr-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2c2c2c] inline-block" />currently locked</span>
              <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />settled or closed</span>
            </span>
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
            <p className="text-[9px] text-[#747878] mt-1">
              {platformStats?.depositSplitLandlordPct === 0 && platformStats?.depositSplitTenantPct === 100
                ? 'All resolved deposits returned in full to tenants'
                : platformStats?.depositSplitLandlordPct === 100 && platformStats?.depositSplitTenantPct === 0
                  ? 'All resolved deposits fully retained by landlords'
                  : 'Computed from recorded on-chain agreement resolutions across the shared escrow'}
            </p>
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
          <h4 className="text-xs font-bold text-black uppercase tracking-wider">
            Deposit Activity {platformStats?.timeWindowLabel ? `(Last ${platformStats.timeWindowLabel})` : ''}
          </h4>
          <span className="text-[9px] text-[#747878]">Bucketed from agreement funded timestamps</span>
        </div>

        <div className="h-56 bg-[#f3f3f3] rounded-xl border border-[#e2e2e2] p-4 flex flex-col justify-between">
          {/* Chart Content Area */}
          <div className="flex-1 relative min-h-0">
            {/* Gridlines & Y-Axis Labels */}
            {[0, 25, 50, 75, 100].map((pct) => {
              const val = (displayMax * (pct / 100)).toFixed(displayMax >= 10 ? 0 : 1);
              return (
                <React.Fragment key={pct}>
                  {/* Gridline (only for 25, 50, 75, 100) */}
                  {pct > 0 && (
                    <div
                      className="absolute left-14 right-0 border-t border-dashed border-[#e2e2e2] pointer-events-none"
                      style={{ bottom: `${pct}%` }}
                    />
                  )}
                  {/* Y-axis label */}
                  <span
                    className="absolute left-2 text-[9px] text-[#747878] font-mono translate-y-1/2 pointer-events-none select-none"
                    style={{ bottom: `${pct}%` }}
                  >
                    {val} XLM
                  </span>
                </React.Fragment>
              );
            })}

            {/* Baseline */}
            <div className="absolute left-14 right-0 bottom-0 border-t border-[#c4c7c7]/50 pointer-events-none" />

            {/* Bars Area */}
            <div className="absolute inset-0 pl-14 flex items-end justify-between">
              {tvlHistory.map((bucket, index) => (
                <DepositBar
                  key={bucket.label + index}
                  bucket={bucket}
                  maxPct={maxPct}
                  index={index}
                  total={tvlHistory.length}
                />
              ))}
            </div>
          </div>

          {/* X-Axis Labels Row */}
          <div className="flex justify-between pl-14 pt-2 border-t border-[#e2e2e2]/60 mt-2">
            {tvlHistory.map((bucket, index) => (
              <span 
                key={index} 
                className={`w-8 text-center text-[9px] font-semibold transition-colors duration-200 ${
                  index === tvlHistory.length - 1 ? 'text-black font-bold' : 'text-[#747878]'
                }`}
              >
                {bucket.label}
              </span>
            ))}
          </div>
        </div>

        {tvlHistory.every((bucket) => bucket.amountXlm === 0) && (
          <p className="text-[10px] text-[#747878] text-center mt-2">
            No newly funded agreements were detected{platformStats?.timeWindowLabel ? ` in the last ${platformStats.timeWindowLabel}` : ''}.
          </p>
        )}
      </div>
    </div>
  );
}
