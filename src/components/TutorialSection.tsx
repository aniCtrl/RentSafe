'use client';

import React from 'react';

export default function TutorialSection() {
  return (
    <section className="bg-ink-black text-paper-bg p-8 md:p-12 mt-16 sharp-corners newsprint-texture select-none">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <div className="border-b border-neutral-600 pb-4 text-center">
          <span className="font-mono text-xs uppercase tracking-widest text-[#CC0000] font-bold">
            Protocol Tutorial
          </span>
          <h2 className="font-serif text-3xl md:text-5xl font-black uppercase mt-1">
            How RentSafe Works
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col gap-2">
            <div className="font-serif text-4xl md:text-5xl font-black text-[#CC0000]">01.</div>
            <h3 className="font-serif text-lg font-bold">Lock Deposit</h3>
            <p className="font-serif text-xs text-neutral-300 leading-relaxed">
              The Tenant funds the rental agreement, transferring the deposit amount into the Escrow
              contract custody on-chain.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="font-serif text-4xl md:text-5xl font-black text-[#CC0000]">02.</div>
            <h3 className="font-serif text-lg font-bold">Activate Lease</h3>
            <p className="font-serif text-xs text-neutral-300 leading-relaxed">
              The Landlord activates the agreement, starting the active lease period. Funds remain
              locked securely in the host contract.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="font-serif text-4xl md:text-5xl font-black text-[#CC0000]">03.</div>
            <h3 className="font-serif text-lg font-bold">Resolve / Settle</h3>
            <p className="font-serif text-xs text-neutral-300 leading-relaxed">
              Either settle the deposit mutually at lease end, or utilize the designated arbitrator
              to execute payout splits under a dispute.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
