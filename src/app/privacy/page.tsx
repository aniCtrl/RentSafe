'use client';

import React from 'react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#1a1c1c] flex flex-col font-sans">
      {/* Header */}
      <header className="bg-[#f9f9f9]/80 backdrop-blur-md text-[#000000] sticky top-0 z-40 border-b border-[#e2e2e2]">
        <div className="flex justify-between items-center px-6 py-4 max-w-6xl mx-auto w-full">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="material-symbols-outlined text-[#000000] text-2xl font-bold">real_estate_agent</span>
            <span className="text-xl font-bold tracking-tight">RentSafe</span>
          </Link>
          <Link href="/" className="text-xs font-bold text-black border border-black px-4 py-2 rounded-xl hover:bg-[#000000] hover:text-white transition-all">
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-3xl mx-auto px-6 py-16 w-full">
        <h1 className="text-3xl font-black tracking-tight text-[#000000] mb-2">Privacy Policy</h1>
        <p className="text-xs text-[#585f6c] mb-8 font-semibold uppercase tracking-wider">Last updated: July 28, 2026</p>

        {/* Testnet Disclaimer Alert Box */}
        <div className="bg-[#fff4e5] border-l-4 border-[#ffa117] p-5 rounded-r-xl mb-10 text-sm text-[#663c00] space-y-2">
          <div className="flex items-center gap-2 font-bold text-[#b26a00]">
            <span className="material-symbols-outlined text-lg">warning</span>
            <span>TESTNET DEMO APPLICATION DISCLAIMER</span>
          </div>
          <p className="text-xs leading-relaxed">
            RentSafe is currently a <strong>Testnet Demonstration Application</strong>. It is designed for trial and evaluation purposes only. No real-world financial assets (including real XLM, USDC, or fiat currency) are custodied, processed, or transferred. All wallet operations occur exclusively on the Stellar Testnet.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-[#333538]">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black">1. Information We Do Not Collect</h2>
            <p>
              We believe in absolute data privacy. RentSafe does not collect, store, or sell any personal identifying information (PII) such as names, email addresses, physical addresses, or phone numbers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black">2. Blockchain Transparency</h2>
            <p>
              By participating in this demo, all actions taken—such as creating an agreement, locking testnet XLM deposit, or raising a dispute—will be recorded permanently on the Stellar Testnet blockchain. Blockchain transactions are public by nature, and we have no control over data visible through blockchain explorers (e.g., stellar.expert).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black">3. Wallet Signatures and Private Keys</h2>
            <p>
              RentSafe does not have access to your wallet's private keys or seed phrases. Any transaction execution requires your explicit approval and signature through your chosen wallet provider (e.g., Freighter, Albedo, or xBull) using standard, secure browser APIs.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black">4. Local Browser Storage</h2>
            <p>
              We utilize your browser's local storage solely to persist session state (such as your connected wallet address and network selector) across page reloads. This data never leaves your local device and can be wiped instantly by clicking the "Flush Log" button in the Settings page.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-black">5. Updates to This Policy</h2>
            <p>
              Since RentSafe is a demo system, this policy may change without formal notification. We recommend reviewing this page periodically for updates.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#f3f3f3] text-[#000000] border-t border-[#e2e2e2] mt-12">
        <div className="px-6 py-8 max-w-6xl mx-auto w-full text-center md:text-left md:flex justify-between items-center text-xs text-[#585f6c]">
          <p>© 2026 RentSafe. Testnet Demonstration Platform.</p>
          <div className="flex gap-4 justify-center mt-4 md:mt-0 font-bold">
            <Link href="/" className="hover:underline text-black">Home</Link>
            <Link href="/terms" className="hover:underline text-black">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
