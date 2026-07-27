'use client';

import React, { useState } from 'react';
import { DEFAULT_ESCROW_ID, DEFAULT_DISPUTE_ID } from '@/lib/stellar';
import { useAppStore } from '@/store/useAppStore';

export default function SettingsView() {
  const { network, setNetwork, clearTransactions } = useAppStore();
  const [copiedEscrow, setCopiedEscrow] = useState(false);
  const [copiedDispute, setCopiedDispute] = useState(false);

  const handleCopyEscrow = () => {
    navigator.clipboard.writeText(DEFAULT_ESCROW_ID);
    setCopiedEscrow(true);
    setTimeout(() => setCopiedEscrow(false), 2000);
  };

  const handleCopyDispute = () => {
    navigator.clipboard.writeText(DEFAULT_DISPUTE_ID);
    setCopiedDispute(true);
    setTimeout(() => setCopiedDispute(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Network Info (Read-Only Transparency Panel) */}
      <div className="bg-[#ffffff] p-6 rounded-[24px] border border-[#e2e2e2] shadow-sm space-y-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#585f6c] text-lg">info</span>
          <h3 className="text-sm font-bold text-black uppercase tracking-wider">Network Info</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[#f9f9f9] rounded-xl border border-[#e2e2e2]">
            <div className="text-[10px] uppercase font-bold text-[#585f6c] tracking-wider mb-1">Active Network</div>
            <div className="text-xs font-bold text-black flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#13a10e] animate-pulse"></span>
              {network === 'testnet' ? 'Stellar Testnet' : 'Stellar Mainnet'}
            </div>
          </div>
          <div className="p-4 bg-[#f9f9f9] rounded-xl border border-[#e2e2e2]">
            <div className="text-[10px] uppercase font-bold text-[#585f6c] tracking-wider mb-1">RPC Node</div>
            <div className="text-xs font-mono text-[#585f6c] truncate">
              {network === 'testnet' ? 'https://soroban-testnet.stellar.org' : 'https://soroban-mainnet.stellar.org'}
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-3 border-t border-[#e2e2e2]">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[11px] font-bold text-[#585f6c] uppercase tracking-wider">Escrow Contract ID</label>
              <button
                onClick={handleCopyEscrow}
                className="text-[10px] text-[#0066cc] hover:underline font-bold flex items-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined text-xs">{copiedEscrow ? 'check' : 'content_copy'}</span>
                {copiedEscrow ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="text-xs p-3 bg-[#f9f9f9] border border-[#e2e2e2] rounded-xl text-black font-mono select-all overflow-x-auto whitespace-nowrap scrollbar-thin">
              {DEFAULT_ESCROW_ID}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[11px] font-bold text-[#585f6c] uppercase tracking-wider">Dispute Contract ID</label>
              <button
                onClick={handleCopyDispute}
                className="text-[10px] text-[#0066cc] hover:underline font-bold flex items-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined text-xs">{copiedDispute ? 'check' : 'content_copy'}</span>
                {copiedDispute ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="text-xs p-3 bg-[#f9f9f9] border border-[#e2e2e2] rounded-xl text-black font-mono select-all overflow-x-auto whitespace-nowrap scrollbar-thin">
              {DEFAULT_DISPUTE_ID}
            </div>
          </div>
        </div>
      </div>

      {/* User settings (Network selection, session/log clearing) */}
      <div className="bg-[#ffffff] p-6 rounded-[24px] border border-[#e2e2e2] shadow-sm space-y-6">
        <h3 className="text-sm font-bold text-black uppercase tracking-wider mb-4">User Settings</h3>

        <div>
          <label className="block text-xs font-semibold text-[#585f6c] mb-2">Switch Active Network</label>
          <div className="flex gap-2">
            <button
              onClick={() => setNetwork('testnet')}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition-colors ${network === 'testnet' ? 'bg-[#000000] text-white border-black' : 'bg-white border-[#c4c7c7] text-[#585f6c]'}`}
            >
              Testnet (SDF Network)
            </button>
            <button
              onClick={() => setNetwork('mainnet')}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs border transition-colors ${network === 'mainnet' ? 'bg-[#000000] text-white border-black' : 'bg-white border-[#c4c7c7] text-[#585f6c]'}`}
            >
              Mainnet (Public Network)
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-[#e2e2e2] flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-black">Flush Session Log</h4>
            <p className="text-[10px] text-[#585f6c]">Clears local transaction and activity buffer</p>
          </div>
          <button
            onClick={() => {
              clearTransactions();
              alert('Local buffers successfully flushed.');
            }}
            className="bg-[#ba1a1a] text-white px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90"
          >
            Flush Log
          </button>
        </div>
      </div>
    </div>
  );
}
