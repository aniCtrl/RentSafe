'use client';

import React, { useState } from 'react';
import { useWalletStore } from '../../state/useWalletStore';
import { useStellar } from '../../hooks/useStellar';
import { 
  Globe, 
  Cpu, 
  FileCode, 
  Check, 
  AlertTriangle 
} from 'lucide-react';

export default function SettingsPage() {
  const service = useStellar();
  const { network, setNetwork, address, connected, walletId } = useWalletStore();

  const [escrowAddr, setEscrowAddr] = useState(service.getConfig().escrow);
  const [disputeAddr, setDisputeAddr] = useState(service.getConfig().dispute);
  const [tokenAddr, setTokenAddr] = useState(service.getConfig().token);
  const [rpcEndpoint, setRpcEndpoint] = useState(service.getConfig().rpcUrl);
  const [saved, setSaved] = useState(false);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem(`rentsafe_${network}_escrow`, escrowAddr);
      localStorage.setItem(`rentsafe_${network}_dispute`, disputeAddr);
      localStorage.setItem(`rentsafe_${network}_token`, tokenAddr);
      localStorage.setItem(`rentsafe_${network}_rpc`, rpcEndpoint);

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Configuration Settings</h2>
        <p className="text-slate-400 text-xs font-semibold">Manage network endpoints, custom contract deployments, and local node connections.</p>
      </div>

      {/* Network parameters */}
      <section className="bg-white border border-slate-200/65 p-6 rounded-2xl space-y-6">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-[#1b8b3a]" />
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Network Selection</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setNetwork('testnet')}
            className={`p-4 rounded-2xl text-left border font-semibold flex flex-col justify-between h-28 transition-all duration-200 ${
              network === 'testnet'
                ? 'bg-[#0f1717] border-[#0f1717] text-white'
                : 'bg-white border-slate-200/60 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-slate-400">Stellar Network</span>
            <div>
              <span className={`text-xs font-bold block ${network === 'testnet' ? 'text-white' : 'text-slate-850'}`}>Stellar Testnet</span>
              <span className="text-[9px] text-slate-400 font-medium block mt-0.5">https://soroban-testnet.stellar.org</span>
            </div>
          </button>

          <button
            onClick={() => setNetwork('local')}
            className={`p-4 rounded-2xl text-left border font-semibold flex flex-col justify-between h-28 transition-all duration-200 ${
              network === 'local'
                ? 'bg-[#0f1717] border-[#0f1717] text-white'
                : 'bg-white border-slate-200/60 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-slate-400">Stellar Network</span>
            <div>
              <span className={`text-xs font-bold block ${network === 'local' ? 'text-white' : 'text-slate-855'}`}>Local Sandbox</span>
              <span className="text-[9px] text-slate-400 font-medium block mt-0.5">http://localhost:8000</span>
            </div>
          </button>
        </div>
      </section>

      {/* Contract & RPC Configuration */}
      <section className="bg-white border border-slate-200/65 p-6 rounded-2xl">
        <form onSubmit={handleSaveConfig} className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-[#1b8b3a]" />
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Contract Addresses</h3>
            </div>
            {saved && (
              <span className="inline-flex items-center gap-1 text-[10px] text-green-700 font-bold bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg">
                <Check className="h-3 w-3" /> Saved successfully
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 block">Escrow Contract Address</label>
              <input
                type="text"
                value={escrowAddr}
                onChange={(e) => setEscrowAddr(e.target.value)}
                className="w-full bg-[#f4f6f6] border border-slate-200 focus:border-[#1b8b3a] rounded-xl p-3 text-xs text-slate-700 font-mono outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 block">Dispute Contract Address</label>
              <input
                type="text"
                value={disputeAddr}
                onChange={(e) => setDisputeAddr(e.target.value)}
                className="w-full bg-[#f4f6f6] border border-slate-200 focus:border-[#1b8b3a] rounded-xl p-3 text-xs text-slate-700 font-mono outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 block">Stellar Asset Contract Address (XLM)</label>
              <input
                type="text"
                value={tokenAddr}
                onChange={(e) => setTokenAddr(e.target.value)}
                className="w-full bg-[#f4f6f6] border border-slate-200 focus:border-[#1b8b3a] rounded-xl p-3 text-xs text-slate-700 font-mono outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 block">Soroban RPC URL Endpoint</label>
              <input
                type="text"
                value={rpcEndpoint}
                onChange={(e) => setRpcEndpoint(e.target.value)}
                className="w-full bg-[#f4f6f6] border border-slate-200 focus:border-[#1b8b3a] rounded-xl p-3 text-xs text-slate-700 font-mono outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="bg-[#1b8b3a] hover:bg-[#156c2d] text-white font-bold py-2.5 px-6 rounded-xl text-xs flex items-center justify-center transition-colors"
          >
            Save Configuration Override
          </button>
        </form>
      </section>

      {/* Wallet diagnostic logs */}
      <section className="bg-white border border-slate-200/65 p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-[#1b8b3a]" />
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Diagnostics</h3>
        </div>

        <div className="bg-[#f4f6f6] rounded-xl p-4 border border-slate-200 text-xs font-mono text-slate-500 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Wallet Connected:</span>
            <span className={connected ? "text-green-600 font-bold" : "text-rose-500 font-bold"}>{connected ? "Yes" : "No"}</span>
          </div>
          {connected && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Wallet Provider ID:</span>
                <span className="text-slate-700 font-semibold">{walletId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Connected Address:</span>
                <span className="text-slate-700 font-semibold break-all select-all">{address}</span>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Network Passphrase:</span>
            <span className="text-slate-700 font-semibold">{service.getConfig().networkPassphrase}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
