'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface MastheadProps {
  address: string;
  balance: string;
  connecting: boolean;
  connectWallet: () => void;
  userRole: string;
  tickerDate: string;
}

export default function Masthead({
  address,
  balance,
  connecting,
  connectWallet,
  userRole,
  tickerDate,
}: MastheadProps) {
  return (
    <header className="border-b-4 border-ink-black px-4 md:px-8 py-6 max-w-screen-xl w-full mx-auto bg-paper-bg">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-ink-black pb-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[#CC0000] font-bold">
            Stellar Network Portal
          </span>
          <h1 className="font-serif text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9] mt-1">
            The RentSafe Gazette
          </h1>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2">
          {address ? (
            <div className="border border-ink-black p-3 bg-white flex flex-col gap-1 w-full md:w-auto sharp-corners">
              <span className="font-mono text-[10px] uppercase text-neutral-500 tracking-wider">
                Connected Account
              </span>
              <span className="font-mono text-xs font-bold break-all">
                {address.substring(0, 10)}...{address.substring(46)}
              </span>
              <div className="flex justify-between items-center gap-4 mt-1 border-t border-dashed border-neutral-300 pt-1">
                <span className="font-mono text-xs text-neutral-600">
                  Balance: <strong className="text-ink-black">{balance} XLM</strong>
                </span>
                <span className="text-[10px] bg-ink-black text-white px-2 py-0.5 uppercase tracking-widest font-mono font-bold">
                  {userRole}
                </span>
              </div>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              disabled={connecting}
              className="bg-ink-black text-paper-bg border border-transparent px-6 py-3 uppercase tracking-widest text-xs font-mono font-bold hover:bg-white hover:text-ink-black hover:border-ink-black transition-all duration-200 w-full md:w-auto flex items-center justify-center gap-2 sharp-corners cursor-pointer"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect Wallet'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Newspaper Sub-Header */}
      <div className="flex justify-between items-center text-xs font-mono py-2 text-neutral-600">
        <span>Vol. I — No. 1</span>
        <span>{tickerDate || 'Loading Edition Date...'}</span>
        <span>Stellar Testnet Edition</span>
      </div>
    </header>
  );
}
