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
    { label: "Total Volume Locked", value: "42,500 XLM", change: "+12.4%", icon: Lock, color: "text-[#1b8b3a] bg-green-50 border-green-100" },
    { label: "Total Escrows Opened", value: "503 Agreements", change: "+8.2%", icon: Layers, color: "text-blue-600 bg-blue-50 border-blue-100" },
    { label: "Resolved Deposits", value: "349 Claims", change: "+15.3%", icon: CheckCircle2, color: "text-green-700 bg-green-50 border-green-100" },
    { label: "Contested Dispute Rate", value: "1.4%", change: "-0.5%", icon: Scale, color: "text-red-600 bg-red-50 border-red-100" }
  ];

  const distribution = [
    { name: "Active Escrows", percentage: 65, color: "bg-[#1b8b3a]", text: "text-[#1b8b3a]" },
    { name: "Pending Deposit", percentage: 20, color: "bg-amber-500", text: "text-amber-600" },
    { name: "Refund Proposed", percentage: 11, color: "bg-blue-500", text: "text-blue-600" },
    { name: "Contested Disputes", percentage: 4, color: "bg-red-500", text: "text-red-600" }
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
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Escrow Analytics</h2>
        <p className="text-slate-400 text-xs font-semibold">Overview of Total Value Locked (TVL), settlement statistics, and smart contract health.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div key={idx} className="bg-white border border-slate-200/60 p-6 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{m.label}</span>
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center border ${m.color}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-extrabold text-slate-850">{m.value}</span>
                <span className={`text-[10px] font-bold ${m.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
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
        <div className="bg-white border border-slate-200/60 p-6 rounded-2xl lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2">
            <BarChart className="h-5 w-5 text-[#1b8b3a]" />
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Monthly Escrow Volume (k XLM)</h3>
          </div>

          <div className="h-64 flex items-end justify-between gap-2 pt-4">
            {monthlyVolume.map((item, idx) => {
              const heightPercent = (item.volume / maxVolume) * 80; // scale to 80% max height
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div className="relative w-full flex justify-center">
                    {/* Label */}
                    <div className="text-[10px] text-slate-400 font-bold mb-1">
                      {item.volume}k
                    </div>
                  </div>
                  {/* Flat Bar */}
                  <div 
                    style={{ height: `${heightPercent}%` }}
                    className="w-full sm:w-10 bg-gradient-to-t from-[#1b8b3a] to-[#22c55e] rounded-t-xl relative"
                  />
                  <span className="text-[11px] font-bold text-slate-400 mt-1">
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* State distribution chart */}
        <div className="bg-white border border-slate-200/60 p-6 rounded-2xl space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-[#1b8b3a]" />
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Agreement Status</h3>
            </div>
            <p className="text-slate-400 text-xs mt-1 font-medium">Breakdown of lease states on-chain.</p>
          </div>

          <div className="space-y-4 py-4">
            {distribution.map((dist, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-500">{dist.name}</span>
                  <span className={dist.text}>{dist.percentage}%</span>
                </div>
                <div className="h-2 w-full bg-[#f4f6f6] rounded-full overflow-hidden border border-slate-200">
                  <div 
                    style={{ width: `${dist.percentage}%` }}
                    className={`h-full rounded-full ${dist.color}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-4 flex items-center justify-between font-semibold">
            <span>Contract Version</span>
            <span className="text-[#1b8b3a] bg-green-50 border border-green-200 px-2 py-0.5 rounded-full text-[9px] font-bold">v1.2.0</span>
          </div>
        </div>
      </div>

      {/* Observability & Status Summary */}
      <section className="bg-white border border-slate-200/60 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#1b8b3a]" />
            Soroban Ledger Performance Indicators
          </h4>
          <p className="text-slate-400 text-xs leading-relaxed max-w-xl font-medium">
            Observability logging metrics are compiled via contract-emitted events. The average network ledger confirmation latency is currently <strong className="text-slate-600">5.2 seconds</strong>, with 100% RPC availability.
          </p>
        </div>
        <div className="flex gap-4 shrink-0 font-semibold text-xs">
          <div className="bg-[#f4f6f6] px-4 py-3 rounded-xl border border-slate-200 flex flex-col items-center">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Avg Fees</span>
            <span className="text-slate-700 font-extrabold mt-0.5">0.012 XLM</span>
          </div>
          <div className="bg-[#f4f6f6] px-4 py-3 rounded-xl border border-slate-200 flex flex-col items-center">
            <span className="text-[9px] font-bold text-slate-400 uppercase">RPC Uptime</span>
            <span className="text-green-600 font-extrabold mt-0.5">99.98%</span>
          </div>
        </div>
      </section>
    </div>
  );
}
