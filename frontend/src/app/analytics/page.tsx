'use client';

import React from 'react';
import { 
  TrendingUp, 
  Lock, 
  CheckCircle2, 
  Scale, 
  BarChart, 
  PieChart, 
  Layers 
} from 'lucide-react';

export default function Analytics() {
  // Mock data for analytics
  const metrics = [
    { label: "Total Volume Locked", value: "42,500 XLM", change: "+12.4%", icon: Lock, color: "text-indigo-400 bg-indigo-500/10" },
    { label: "Total Escrows Opened", value: "503 Agreements", change: "+8.2%", icon: Layers, color: "text-violet-400 bg-violet-500/10" },
    { label: "Resolved Deposits", value: "349 Claims", change: "+15.3%", icon: CheckCircle2, color: "text-green-400 bg-green-500/10" },
    { label: "Contested Dispute Rate", value: "1.4%", change: "-0.5%", icon: Scale, color: "text-rose-400 bg-rose-500/10" }
  ];

  const distribution = [
    { name: "Active Escrows", percentage: 65, color: "bg-green-500", text: "text-green-400" },
    { name: "Pending Deposit", percentage: 20, color: "bg-amber-500", text: "text-amber-400" },
    { name: "Refund proposed", percentage: 11, color: "bg-indigo-500", text: "text-indigo-400" },
    { name: "Contested disputes", percentage: 4, color: "bg-rose-500", text: "text-rose-400" }
  ];

  const monthlyVolume = [
    { month: "Jan", volume: 15 },
    { month: "Feb", volume: 22 },
    { month: "Mar", volume: 18 },
    { month: "Apr", volume: 30 },
    { month: "May", volume: 25 },
    { month: "Jun", volume: 38 },
    { month: "Jul", volume: 42 }
  ];

  const maxVolume = Math.max(...monthlyVolume.map(v => v.volume));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">Escrow Analytics</h2>
        <p className="text-slate-400 text-xs font-medium">Overview of Total Value Locked (TVL), settlement statistics, and smart contract health.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div key={idx} className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">{m.label}</span>
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${m.color}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-white">{m.value}</span>
                <span className={`text-xs font-bold ${m.change.startsWith('+') ? 'text-green-400' : 'text-rose-400'}`}>
                  {m.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Locked Volume Chart (SVG based) */}
        <div className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2">
            <BarChart className="h-5 w-5 text-indigo-400" />
            <h3 className="font-bold text-white text-base">Monthly Escrow Volume (k XLM)</h3>
          </div>

          <div className="h-64 flex items-end justify-between gap-2 pt-4">
            {monthlyVolume.map((item, idx) => {
              const heightPercent = (item.volume / maxVolume) * 80; // scale to 80% max height
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="relative w-full flex justify-center">
                    {/* Tooltip */}
                    <div className="absolute -top-8 bg-slate-950 text-indigo-300 font-bold border border-slate-800 text-[10px] py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                      {item.volume}k XLM
                    </div>
                  </div>
                  {/* Glowing Bar */}
                  <div 
                    style={{ height: `${heightPercent}%` }}
                    className="w-full sm:w-10 bg-gradient-to-t from-indigo-600/80 to-indigo-500 rounded-t-xl group-hover:from-indigo-500 group-hover:to-violet-400 transition-all duration-300 relative shadow-lg shadow-indigo-600/20"
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 rounded-t-xl transition-opacity" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-300 mt-1 transition-colors">
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* State distribution chart */}
        <div className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-indigo-400" />
              <h3 className="font-bold text-white text-base">Agreement Status Distribution</h3>
            </div>
            <p className="text-slate-500 text-xs mt-1 font-medium">Breakdown of lease states on-chain.</p>
          </div>

          <div className="space-y-4 py-4">
            {distribution.map((dist, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">{dist.name}</span>
                  <span className={dist.text}>{dist.percentage}%</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                  <div 
                    style={{ width: `${dist.percentage}%` }}
                    className={`h-full rounded-full ${dist.color}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-slate-500 border-t border-slate-850/60 pt-4 flex items-center justify-between font-semibold">
            <span>Contract Version</span>
            <span className="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/10">v1.2.0</span>
          </div>
        </div>
      </div>

      {/* Observability & Status Summary */}
      <section className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <h4 className="font-bold text-white text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-400" />
            Soroban Ledger Performance Indicators
          </h4>
          <p className="text-slate-500 text-xs leading-relaxed max-w-xl font-medium">
            Observability logging metrics are compiled via contract-emitted events. The average network ledger confirmation latency is currently <strong className="text-slate-300">5.2 seconds</strong>, with 100% RPC availability.
          </p>
        </div>
        <div className="flex gap-4 shrink-0">
          <div className="bg-slate-950 px-4 py-3 rounded-xl border border-slate-850 flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Avg Fees</span>
            <span className="text-sm font-extrabold text-indigo-400 mt-0.5">0.012 XLM</span>
          </div>
          <div className="bg-slate-950 px-4 py-3 rounded-xl border border-slate-850 flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase">RPC Uptime</span>
            <span className="text-sm font-extrabold text-green-400 mt-0.5">99.98%</span>
          </div>
        </div>
      </section>
    </div>
  );
}
