'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/useAppStore';

const WalletConnectModal = dynamic(() => import('@/components/WalletConnectModal'), { ssr: false });

function LandingPage() {
  const { address, themeMode, toggleTheme } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#1a1c1c] flex flex-col font-sans">
      {/* TopNavBar Component */}
      <header className="bg-[#f9f9f9]/80 backdrop-blur-md text-[#000000] sticky top-0 z-40 border-b border-[#e2e2e2]">
        <div className="flex justify-between items-center px-6 py-4 max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#000000] text-2xl font-bold">real_estate_agent</span>
            <span className="text-xl font-bold tracking-tight">RentSafe</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#585f6c]">
            <a className="hover:text-[#000000] transition-colors" href="#product">Product</a>
            <a className="hover:text-[#000000] transition-colors" href="#how-it-works">How it works</a>
          </nav>
          
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-pressed={themeMode === 'dark'}
              title={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggleTheme}
              className="rounded-full p-2 text-[#585f6c] hover:bg-[#eeeeee] hover:text-[#000000]"
            >
              <span className="material-symbols-outlined text-lg">{themeMode === 'dark' ? 'light_mode' : 'dark_mode'}</span>
            </button>
            {address ? (
              <>
                <Link 
                  href="/dashboard"
                  className="bg-[#000000] text-[#ffffff] px-5 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 transition-opacity"
                >
                  Go to Dashboard
                </Link>
                <span className="text-xs text-[#585f6c] font-mono bg-[#eeeeee] px-2.5 py-1.5 rounded-lg border border-[#c4c7c7]/30">
                  {address.slice(0, 4)}...{address.slice(-4)}
                </span>
              </>
            ) : (
              <button 
                onClick={() => setModalOpen(true)}
                className="bg-[#000000] text-[#ffffff] px-5 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 transition-opacity"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="px-6 pt-20 pb-12 max-w-4xl mx-auto text-center flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[#000000] max-w-2xl mb-4 leading-tight">
            Rental deposits, secured by code, not trust.
          </h1>
          <p className="text-base text-[#585f6c] max-w-xl mb-8 leading-relaxed">
            Decentralized escrow built on the Stellar blockchain. Fast, fair, and fully automated.
          </p>
          <div className="flex gap-4">
            {address ? (
              <Link 
                href="/create"
                className="bg-[#000000] text-[#ffffff] px-6 py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-sm"
              >
                Create Rental Agreement
              </Link>
            ) : (
              <button 
                onClick={() => setModalOpen(true)}
                className="bg-[#000000] text-[#ffffff] px-6 py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-sm"
              >
                Start Free Escrow
              </button>
            )}
            <a 
              href="#how-it-works"
              className="border border-[#c4c7c7] text-[#000000] px-6 py-3.5 rounded-xl font-bold text-sm hover:bg-[#eeeeee] transition-colors"
            >
              See How It Works
            </a>
          </div>
        </section>

        {/* Dashboard Preview Card */}
        <section className="px-6 py-12 max-w-6xl mx-auto">
          <div className="bg-[#f3f3f3] rounded-[32px] p-8 md:p-12 flex justify-center items-center">
            <div className="bg-[#ffffff] rounded-[24px] p-6 premium-shadow w-full max-w-lg border border-[#c4c7c7]/30">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#e2e2e2]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#000000] text-xl">lock</span>
                  <h3 className="text-sm font-bold text-[#000000]">Escrow Status</h3>
                </div>
                <span className="bg-[#dce2f3] text-[#5e6572] px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
                  ACTIVE
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider mb-1">STATUS</p>
                  <p className="text-sm font-semibold text-[#000000]">Deposit Locked</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider mb-1">AMOUNT</p>
                  <p className="text-lg font-bold text-[#000000]">
                    2,500 XLM
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider mb-1">COUNTDOWN</p>
                  <div className="flex items-center gap-2 text-sm text-[#000000] font-semibold">
                    <span className="material-symbols-outlined text-[#000000] text-base">schedule</span>
                    <span>11 Months remaining</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Powered By Section */}
        <section className="px-6 py-8 max-w-6xl mx-auto border-t border-b border-[#e2e2e2] opacity-60">
          <p className="text-center text-[10px] font-bold tracking-wider text-[#585f6c] mb-4 uppercase">POWERED BY</p>
          <div className="flex justify-center items-center gap-12 grayscale">
            <div className="text-sm font-extrabold text-[#585f6c] tracking-widest">STELLAR</div>
            <div className="text-sm font-extrabold text-[#585f6c] tracking-widest">SOROBAN</div>
            <div className="text-sm font-extrabold text-[#585f6c] tracking-widest">FREIGHTER</div>
          </div>
        </section>

        {/* Features Section */}
        <section id="product" className="px-6 py-16 max-w-6xl mx-auto scroll-mt-20">
          <h2 className="text-center text-2xl font-bold text-[#000000] mb-12 tracking-tight">Why RentSafe</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="bg-[#ffffff] p-6 rounded-2xl soft-shadow hover-shadow border border-[#e2e2e2] transition-all">
              <div className="bg-[#eeeeee] w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[#000000] text-xl">bolt</span>
              </div>
              <h3 className="text-sm font-bold text-[#000000] mb-2">Instant Escrow</h3>
              <p className="text-xs text-[#585f6c] leading-relaxed">Fast setup with smart contracts. No manual paperwork or processing delay.</p>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-[#ffffff] p-6 rounded-2xl soft-shadow hover-shadow border border-[#e2e2e2] transition-all">
              <div className="bg-[#eeeeee] w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[#000000] text-xl">receipt_long</span>
              </div>
              <h3 className="text-sm font-bold text-[#000000] mb-2">Transparent Records</h3>
              <p className="text-xs text-[#585f6c] leading-relaxed">Verifiable on-chain transaction history visible for both landlords and tenants.</p>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-[#ffffff] p-6 rounded-2xl soft-shadow hover-shadow border border-[#e2e2e2] transition-all">
              <div className="bg-[#eeeeee] w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[#000000] text-xl">sync_alt</span>
              </div>
              <h3 className="text-sm font-bold text-[#000000] mb-2">Automated Payouts</h3>
              <p className="text-xs text-[#585f6c] leading-relaxed">Safe split release at lease end based on direct mutual consensus or arbitration.</p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="px-6 py-16 max-w-6xl mx-auto border-t border-[#e2e2e2] scroll-mt-20">
          <h2 className="text-center text-2xl font-bold text-[#000000] mb-12 tracking-tight">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm mb-4">1</div>
              <h3 className="text-sm font-bold text-[#000000] mb-2">Create Agreement</h3>
              <p className="text-xs text-[#585f6c] leading-relaxed max-w-xs">
                Landlord and tenant set the rental terms and security deposit on RentSafe.
              </p>
            </div>
            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm mb-4">2</div>
              <h3 className="text-sm font-bold text-[#000000] mb-2">Lock Deposit</h3>
              <p className="text-xs text-[#585f6c] leading-relaxed max-w-xs">
                The tenant locks the deposit securely in the Soroban escrow contract using a Stellar wallet.
              </p>
            </div>
            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm mb-4">3</div>
              <h3 className="text-sm font-bold text-[#000000] mb-2">Resolve &amp; Settle</h3>
              <p className="text-xs text-[#585f6c] leading-relaxed max-w-xs">
                At lease end, funds are settled through mutual agreement. If a deduction is disputed, both parties can negotiate a settlement or follow the dispute resolution process.
              </p>
            </div>
          </div>
        </section>

        {/* Stats Card Section */}
        <section className="px-6 py-16 max-w-6xl mx-auto">
          <div className="bg-[#e2e2e2] p-8 md:p-12 rounded-[32px] grid grid-cols-1 md:grid-cols-2 gap-8 items-center border border-[#c4c7c7]/30">
            <div>
              <h2 className="text-4xl font-extrabold text-[#000000] tracking-tight mb-4">$0 Disputes Escaped</h2>
              <p className="text-sm text-[#000000] leading-relaxed mb-6">
                RentSafe has completely removed the friction and anxiety from managing security deposits. By utilizing smart contracts, automated sign-offs guarantee that funds are custodied and returned without delays.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#ffffff] p-4 rounded-2xl soft-shadow border border-[#e2e2e2]">
                <p className="text-xl font-bold text-[#000000] mb-1">500+</p>
                <p className="text-xs text-[#585f6c]">Deposits secured</p>
              </div>
              <div className="bg-[#ffffff] p-4 rounded-2xl soft-shadow border border-[#e2e2e2]">
                <p className="text-xl font-bold text-[#000000] mb-1">1,200+</p>
                <p className="text-xs text-[#585f6c]">Hours saved</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Component */}
      <footer className="bg-[#f3f3f3] text-[#000000] border-t border-[#e2e2e2]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-6 py-12 max-w-6xl mx-auto w-full">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[#000000] text-xl font-bold">real_estate_agent</span>
              <span className="text-base font-bold tracking-tight">RentSafe</span>
            </div>
            <p className="text-xs text-[#585f6c]">© 2026 RentSafe. Decentralized security for modern living.</p>
          </div>
          <div>
            <h4 className="text-xs font-bold mb-3 uppercase tracking-wider text-[#000000]">Legal</h4>
            <ul className="space-y-2 text-xs text-[#585f6c]">
              <li><Link className="hover:underline" href="/terms">Terms of Service</Link></li>
              <li><Link className="hover:underline" href="/privacy">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold mb-3 uppercase tracking-wider text-[#000000]">Source</h4>
            <ul className="space-y-2 text-xs text-[#585f6c]">
              <li><a className="hover:underline" href="https://github.com/aniCtrl" target="_blank" rel="noopener noreferrer">GitHub Profile</a></li>
              <li><a className="hover:underline" href="https://github.com/aniCtrl/rentsafe" target="_blank" rel="noopener noreferrer">View Source</a></li>
            </ul>
          </div>
        </div>
      </footer>

      {/* Wallet Connect Modal */}
      <WalletConnectModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />
    </div>
  );
}

export default dynamic(() => Promise.resolve(LandingPage), { ssr: false });
