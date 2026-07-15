'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Key, 
  Lock, 
  Scale, 
  Globe, 
  Layers,
  ArrowRight,
  Home,
  CheckCircle,
  FileText,
  UserCheck
} from 'lucide-react';

export default function LandingPage() {
  const steps = [
    {
      icon: FileText,
      stepNum: "01",
      title: "Create Agreement",
      description: "Landlord specifies the tenant's wallet address, lease terms, and the required deposit in XLM."
    },
    {
      icon: Lock,
      stepNum: "02",
      title: "Lock Deposit",
      description: "Tenant logs in, approves the terms, and securely deposits the funds directly into the Soroban escrow contract."
    },
    {
      icon: ShieldCheck,
      stepNum: "03",
      title: "Settle or Dispute",
      description: "At lease end, release the deposit back to the tenant, approve deductions, or trigger the dispute callback."
    }
  ];

  const features = [
    {
      icon: ShieldCheck,
      title: "Neutral Escrows",
      description: "Security deposits are held securely on-chain, not by the landlord, eliminating direct capital access conflict."
    },
    {
      icon: Key,
      title: "Self-Custodial Control",
      description: "Connect standard Stellar wallets (Freighter, xBull, Hana) to directly sign escrow state updates."
    },
    {
      icon: Scale,
      title: "Automated Arbitration",
      description: "Disputes are automatically routed via inter-contract C2C calls to registry code for neutral resolution."
    }
  ];

  const mockListings = [
    {
      title: "El Nido Penthouse",
      location: "Palawan Region",
      depositUsd: "1,200",
      depositXlm: "5,000",
      rating: "4.8",
      imgUrl: "https://placehold.co/400x300/0f172a/ffffff?text=El+Nido+Penthouse"
    },
    {
      title: "Siargao Beach House",
      location: "Surigao del Norte",
      depositUsd: "850",
      depositXlm: "3,500",
      rating: "4.9",
      imgUrl: "https://placehold.co/400x300/0f172a/ffffff?text=Siargao+Beach+House"
    },
    {
      title: "Vigan Heritage Villa",
      location: "Ilocos Region",
      depositUsd: "950",
      depositXlm: "4,000",
      rating: "4.7",
      imgUrl: "https://placehold.co/400x300/0f172a/ffffff?text=Vigan+Heritage+Villa"
    },
    {
      title: "Baguio Forest Cabin",
      location: "Benguet Region",
      depositUsd: "700",
      depositXlm: "3,000",
      rating: "4.6",
      imgUrl: "https://placehold.co/400x300/0f172a/ffffff?text=Baguio+Forest+Cabin"
    }
  ];

  return (
    <div className="space-y-24 pb-24 bg-white text-[#0f171b]">
      {/* 1. Hero Banner Section (WANDER style) */}
      <section className="px-6 lg:px-16 pt-6">
        <div className="relative rounded-3xl overflow-hidden h-[550px] bg-slate-900 flex items-center">
          {/* Background image overlay */}
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-65"
            style={{ backgroundImage: "url('/hero-banner.png')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 to-transparent" />

          {/* Overlaid Hero Content */}
          <div className="relative z-10 max-w-2xl ml-8 md:ml-16 space-y-6 text-white">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight font-sans">
              RENTSAFE.
            </h1>
            <p className="text-lg md:text-xl font-medium text-slate-200 leading-relaxed">
              Lock your rental security deposit in a neutral, programmable smart contract. Complete tenant and landlord protection with zero middlemen.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link 
                href="/dashboard"
                className="bg-[#1b8b3a] hover:bg-[#156c2d] text-white text-xs font-semibold py-3 px-6 rounded-full transition-colors"
              >
                Launch Dashboard
              </Link>
              <a 
                href="#listings"
                className="bg-white/20 hover:bg-white/30 text-white border border-white/35 text-xs font-semibold py-3 px-6 rounded-full transition-colors"
              >
                Explore Active Escrows
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Features Double Column (WANDER style) */}
      <section id="features" className="max-w-7xl mx-auto px-6 lg:px-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Why Thousands of Users Choose RentSafe for Rental Security Escrows
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            By shifting security deposits from landlord bank accounts directly into autonomous Soroban smart contracts, RentSafe establishes trust. Landlords get verified proof of funds, and tenants are protected against arbitrary capital retention.
          </p>
          
          {/* Stats Counters (WANDER style) */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-100">
            <div>
              <span className="text-2xl font-bold text-slate-900 block">10k+</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-1">Secured Tenants</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block">5yrs</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-1">Core Experience</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-slate-900 block">50+</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-1">Contracts Linked</span>
            </div>
          </div>
        </div>

        {/* Right Feature Column Cards */}
        <div className="space-y-4">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div 
                key={idx}
                className="bg-[#f4f6f6] border border-slate-200/50 p-6 rounded-2xl flex gap-4 items-start"
              >
                <div className="p-2.5 bg-white border border-slate-200/60 rounded-xl text-[#1b8b3a] shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">{feature.title}</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Listings Grid Section (WANDER style) */}
      <section id="listings" className="bg-[#f4f6f6] py-16 px-6 lg:px-16">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-[#0f171b] tracking-tight">Active Escrows & Listings</h2>
              <p className="text-xs text-slate-500 mt-1">Review active, mock properties with transparent locked on-chain escrows</p>
            </div>
            <Link 
              href="/dashboard"
              className="text-xs font-bold text-[#1b8b3a] hover:text-[#156c2d] flex items-center gap-1.5 transition-colors"
            >
              Launch Platform Dashboard <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Grid Layout of Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {mockListings.map((listing, idx) => (
              <div 
                key={idx}
                className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                <div 
                  className="h-44 w-full bg-slate-100 bg-cover bg-center"
                  style={{ backgroundImage: `url(${listing.imgUrl})` }}
                />
                <div className="p-5 space-y-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">{listing.location}</span>
                    <h3 className="text-sm font-bold text-[#0f171b] mt-1">{listing.title}</h3>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Security Deposit</span>
                      <span className="text-xs font-bold text-[#0f171b] mt-0.5 block">
                        ${listing.depositUsd} <span className="text-[10px] text-[#1b8b3a]">({listing.depositXlm} XLM)</span>
                      </span>
                    </div>
                    <span className="bg-[#eef2f2] text-[#1b8b3a] text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-200">
                      ★ {listing.rating}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Stepper Process (WANDER style) */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 lg:px-16 space-y-12">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Security Deposit Made Easy as 1-2-3</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">Get absolute protection in three simple, cryptographically-secure steps</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div 
                key={idx}
                className="bg-white border border-slate-200/60 p-6 rounded-2xl space-y-4 relative"
              >
                {/* Step number badge */}
                <div className="flex justify-between items-center">
                  <div className="p-2.5 bg-[#f4f6f6] border border-slate-200/60 rounded-xl text-[#1b8b3a]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-lg font-bold text-slate-200">{step.stepNum}</span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">{step.title}</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
