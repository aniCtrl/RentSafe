'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import { NATIVE_XLM_ID, initializeWalletsKit, readContractView } from '@/lib/stellar';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
  const { setAddress, setBalance, network, setNetwork, setWalletId } = useAppStore();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (walletId: string) => {
    try {
      setConnecting(walletId);
      setError(null);

      await initializeWalletsKit(network, walletId);

      // Fetch the wallet address
      const res = await StellarWalletsKit.fetchAddress();
      if (res && res.address) {
        setWalletId(walletId);
        setAddress(res.address);

        // Fetch XLM balance (simulate call via contract Service)
        try {
          const balVal = await readContractView(NATIVE_XLM_ID, 'balance', [res.address]);
          setBalance((Number(balVal) / 10000000).toFixed(2));
        } catch (balErr) {
          console.error('Failed to load user balance:', balErr);
          setBalance('0.00');
        }

        onClose();
      } else {
        throw new Error('No address returned from wallet');
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to connect. Make sure extension is installed and unlocked.');
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Dimmed Background Overlay */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative bg-[#ffffff] text-[#1a1c1c] w-[420px] max-w-full mx-6 rounded-[24px] shadow-[0px_4px_24px_rgba(0,0,0,0.06)] border border-[#e2e2e2] flex flex-col p-6 z-50">
        
        {/* Header */}
        <header className="flex flex-col relative mb-4">
          <button 
            onClick={onClose}
            aria-label="Close" 
            className="absolute top-0 right-0 p-1.5 text-[#747878] hover:text-[#000000] hover:bg-[#f3f3f3] rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="pr-10">
            <h1 className="text-xl font-bold tracking-tight text-[#000000] mb-1">Connect your Stellar Wallet</h1>
            <p className="text-xs text-[#585f6c]">Choose a wallet to securely sign transactions.</p>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex flex-col gap-4 py-4 border-t border-[#c4c7c7]/30">
          
          {/* Network Selector */}
          <div className="flex flex-col gap-1.5 mb-2">
            <label className="text-[10px] font-bold tracking-wider text-[#585f6c] uppercase">NETWORK</label>
            <div className="relative group cursor-pointer">
              <select 
                value={network}
                onChange={(e) => setNetwork(e.target.value as 'testnet' | 'mainnet')}
                className="w-full appearance-none bg-[#ffffff] border border-[#c4c7c7] rounded-xl py-2 px-3 pr-10 text-sm text-[#000000] focus:outline-none focus:border-[#000000] focus:ring-1 focus:ring-[#000000] transition-colors"
              >
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet (Production)</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#747878]">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Wallet List */}
          <div className="flex flex-col gap-2">
            
            {/* Freighter */}
            <button 
              onClick={() => handleConnect('freighter')}
              disabled={connecting !== null}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-[#c4c7c7]/60 bg-[#ffffff] hover:border-[#000000] hover:shadow-[0px_4px_12px_rgba(0,0,0,0.03)] transition-all group disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#f3f3f3] flex items-center justify-center border border-[#c4c7c7]/20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#000000]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-[#000000]">Freighter</span>
              </div>
              {connecting === 'freighter' ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#747878] group-hover:text-[#000000] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>

            {/* Albedo */}
            <button 
              onClick={() => handleConnect('albedo')}
              disabled={connecting !== null}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-[#c4c7c7]/60 bg-[#ffffff] hover:border-[#000000] hover:shadow-[0px_4px_12px_rgba(0,0,0,0.03)] transition-all group disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#f3f3f3] flex items-center justify-center border border-[#c4c7c7]/20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#000000]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 01-2 2m2-2a2 2 0 00-2-2m2 2a2 2 0 00-2 2m0 0a2 2 0 01-2-2m0 0a2 2 0 012-2m-2 2a2 2 0 002-2m-2 2a2 2 0 002 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-[#000000]">Albedo</span>
              </div>
              {connecting === 'albedo' ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#747878] group-hover:text-[#000000] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>

            {/* xBull */}
            <button 
              onClick={() => handleConnect('xbull')}
              disabled={connecting !== null}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-[#c4c7c7]/60 bg-[#ffffff] hover:border-[#000000] hover:shadow-[0px_4px_12px_rgba(0,0,0,0.03)] transition-all group disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#f3f3f3] flex items-center justify-center border border-[#c4c7c7]/20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#000000]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-[#000000]">xBull</span>
              </div>
              {connecting === 'xbull' ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#747878] group-hover:text-[#000000] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 text-xs text-[#ba1a1a] bg-[#ffdad6]/40 rounded-xl border border-[#ffdad6]">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-4 pt-4 border-t border-[#c4c7c7]/30 text-center">
          <p className="text-[10px] text-[#585f6c]">
            By connecting, you agree to RentSafe’s{' '}
            <a href="#" className="text-black font-semibold hover:underline">
              Terms of Service
            </a>
            .
          </p>
        </footer>
      </div>
    </div>
  );
}
