'use client';

import React, { useState } from 'react';
import { useWalletStore } from '../../state/useWalletStore';
import { useStellar } from '../../hooks/useStellar';
import contractsConfig from '../../contracts-config.json';
import { 
  Settings, 
  Globe, 
  Cpu, 
  FileCode, 
  Check, 
  HelpCircle,
  AlertTriangle 
} from 'lucide-react';

export default function SettingsPage() {
  const service = useStellar();
  const { network, setNetwork, address, walletId, connected } = useWalletStore();

  const [escrowAddr, setEscrowAddr] = useState(service.getConfig().escrow);
  const [disputeAddr, setDisputeAddr] = useState(service.getConfig().dispute);
  const [tokenAddr, setTokenAddr] = useState(service.getConfig().token);
  const [rpcEndpoint, setRpcEndpoint] = useState(service.getConfig().rpcUrl);
  const [saved, setSaved] = useState(false);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      // Modify configuration on runtime (e.g. write to a runtime state or localstorage fallback)
      // For this SaaS structure, we can store override configurations in localStorage
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
        <h2 className="text-2xl font-bold text-white tracking-tight">Configuration Settings</h2>
        <p className="text-slate-400 text-xs font-medium">Manage network endpoints, custom contract deployments, and local node connections.</p>
      </div>

      {/* Network parameters */}
      <section className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl space-y-6">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-indigo-400" />
          <h3 className="font-bold text-white text-base">Network Selection</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setNetwork('testnet')}
            className={`p-4 rounded-xl text-left border font-semibold flex flex-col justify-between h-28 transition-all ${
              network === 'testnet'
                ? 'bg-indigo-650/10 border-indigo-500 text-white'
                : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
            }`}
          >
            <span className="text-xs uppercase font-bold text-slate-500">Stellar Network</span>
            <div>
              <span className="text-sm font-bold text-slate-200 block">Stellar Testnet</span>
              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">https://soroban-testnet.stellar.org</span>
            </div>
          </button>

          <button
            onClick={() => setNetwork('local')}
            className={`p-4 rounded-xl text-left border font-semibold flex flex-col justify-between h-28 transition-all ${
              network === 'local'
                ? 'bg-indigo-650/10 border-indigo-500 text-white'
                : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
            }`}
          >
            <span className="text-xs uppercase font-bold text-slate-500">Stellar Network</span>
            <div>
              <span className="text-sm font-bold text-slate-200 block">Local Standalone Sandbox</span>
              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">http://localhost:8000</span>
            </div>
          </button>
        </div>
      </section>

      {/* Contract & RPC Configuration */}
      <section className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl">
        <form onSubmit={handleSaveConfig} className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-indigo-400" />
              <h3 className="font-bold text-white text-base">Contract Addresses</h3>
            </div>
            {saved && (
              <span className="inline-flex items-center gap-1 text-xs text-green-400 font-semibold bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-lg animate-fade-in">
                <Check className="h-3 w-3" /> Saved successfully
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Escrow Contract Address</label>
              <input
                type="text"
                value={escrowAddr}
                onChange={(e) => setEscrowAddr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-300 font-mono outline-none"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Dispute Contract Address</label>
              <input
                type="text"
                value={disputeAddr}
                onChange={(e) => setDisputeAddr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-300 font-mono outline-none"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Stellar Asset Contract Token Address (XLM)</label>
              <input
                type="text"
                value={tokenAddr}
                onChange={(e) => setTokenAddr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-300 font-mono outline-none"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Soroban RPC URL Endpoint</label>
              <input
                type="text"
                value={rpcEndpoint}
                onChange={(e) => setRpcEndpoint(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-300 font-mono outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="bg-indigo-650 hover:bg-indigo-650/95 border border-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs flex items-center justify-center transition-colors"
          >
            Save Configuration Override
          </button>
        </form>
      </section>

      {/* Wallet diagnostic logs */}
      <section className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-indigo-400" />
          <h3 className="font-bold text-white text-base">Diagnostics</h3>
        </div>

        <div className="bg-slate-950 rounded-xl p-4 border border-slate-850 text-xs font-mono text-slate-400 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Wallet Connected:</span>
            <span className={connected ? "text-green-400" : "text-rose-400"}>{connected ? "Yes" : "No"}</span>
          </div>
          {connected && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">Wallet Provider ID:</span>
                <span className="text-slate-300">{walletId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Connected Address:</span>
                <span className="text-slate-300 break-all select-all">{address}</span>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Network Passphrase:</span>
            <span className="text-slate-300">{service.getConfig().networkPassphrase}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
