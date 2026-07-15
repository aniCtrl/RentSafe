'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Key, 
  ArrowRight, 
  Lock, 
  UserCheck, 
  TrendingUp, 
  FileText, 
  Scale 
} from 'lucide-react';

export default function LandingPage() {
  const steps = [
    {
      icon: FileText,
      title: "1. Create Agreement",
      description: "Landlord specifies the tenant's wallet address, the deposit amount in XLM, and initiates the agreement."
    },
    {
      icon: Lock,
      title: "2. Lock Deposit",
      description: "Tenant logs in, approves the terms, and securely deposits the funds directly into the Soroban smart contract."
    },
    {
      icon: ShieldCheck,
      title: "3. Neutral Protection",
      description: "Funds remain locked in the neutral blockchain contract, earning no-one interest and immune to premature withdrawals."
    },
    {
      icon: Scale,
      title: "4. Settle or Dispute",
      description: "At lease end, approve landlord's deduction or activate inter-contract dispute resolution for neutral arbitration."
    }
  ];

  const features = [
    {
      icon: UserCheck,
      title: "Role-Based Dashboards",
      description: "Tailored dashboards for both Tenants and Landlords to track claims and initiate actions."
    },
    {
      icon: Key,
      title: "Self-Custodial Wallets",
      description: "Integrated with Stellar Wallets Kit. Connect Freighter, xBull, or Hana seamlessly."
    },
    {
      icon: ShieldCheck,
      title: "Soroban Smart Contracts",
      description: "Leverages custom persistent storage, contract-to-contract callbacks, and automated state transitions."
    }
  ];

  return (
    <div className="space-y-24 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800/80 px-8 py-16 text-center lg:py-24">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-3xl mx-auto space-y-6 relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            <ShieldCheck className="h-3.5 w-3.5" />
            Soroban Orange Belt (Level 3) Certified
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-400 bg-clip-text text-transparent">
            Programmable Escrow for Security Deposits
          </h1>

          <p className="text-slate-400 text-lg leading-relaxed max-w-2xl mx-auto">
            Ditch traditional trust-based renting. RentSafe locks security deposits in neutral, decentralized smart contracts, protecting both tenants and landlords.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/dashboard"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 px-6 rounded-xl flex items-center gap-2 group shadow-lg shadow-indigo-600/10 hover:scale-[1.02] active:scale-95 transition-all duration-300 w-full sm:w-auto justify-center"
            >
              Enter Escrow Panel
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              className="bg-slate-800 hover:bg-slate-700/80 border border-slate-750 text-slate-200 font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 w-full sm:w-auto hover:text-white"
            >
              How It Works
            </a>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-slate-900/40 border border-slate-850/60 p-6 rounded-2xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block">Total Locked Volume (TVL)</span>
            <span className="text-2xl font-extrabold text-white mt-1 block">42,500 XLM</span>
          </div>
        </div>
        <div className="bg-slate-900/40 border border-slate-850/60 p-6 rounded-2xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 shrink-0">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block">Active Agreements</span>
            <span className="text-2xl font-extrabold text-white mt-1 block">154 Contracts</span>
          </div>
        </div>
        <div className="bg-slate-900/40 border border-slate-850/60 p-6 rounded-2xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 shrink-0">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block">Escrows Released</span>
            <span className="text-2xl font-extrabold text-white mt-1 block">349 settled</span>
          </div>
        </div>
      </section>

      {/* How it Works Step-by-Step */}
      <section id="how-it-works" className="space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-white tracking-tight">Standard Lease Lifecycle</h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
            RentSafe handles security deposits completely on-chain, from initialization to disbursement or dispute settlement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div 
                key={idx} 
                className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl space-y-4 hover:border-slate-700/80 transition-colors duration-300"
              >
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-white text-base">{step.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{step.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-slate-900/40 border border-slate-850 rounded-3xl p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {features.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <div key={idx} className="space-y-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">{feature.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">{feature.description}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
