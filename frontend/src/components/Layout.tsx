'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  useWalletStore 
} from '../state/useWalletStore';
import { 
  useTransactionStore 
} from '../state/useTransactionStore';
import { 
  Wallet, 
  Settings, 
  Activity, 
  BarChart3, 
  LayoutDashboard, 
  Home, 
  Copy, 
  Check, 
  LogOut, 
  Globe, 
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { 
    address, 
    connected, 
    balance, 
    network, 
    connect, 
    disconnect, 
    setNetwork, 
    isConnecting, 
    error 
  } = useWalletStore();

  const { transactions, retry } = useTransactionStore();

  const [copied, setCopied] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showTxCenter, setShowTxCenter] = useState(false);

  const activeTxCount = transactions.filter(t => t.status === 'pending' || t.status === 'processing').length;

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncateAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const wallets = [
    { id: 'freighter', name: 'Freighter Wallet', icon: '🚀' },
    { id: 'xbull', name: 'xBull Wallet', icon: '🐂' },
    { id: 'hana', name: 'Hana Wallet', icon: '🌸' }
  ];

  const sidebarLinks = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Escrow Panel', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Activity Feed', href: '/activity', icon: Activity },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/60 border-r border-slate-800/80 backdrop-blur-xl flex flex-col justify-between fixed h-screen z-10">
        <div>
          {/* Logo */}
          <div className="p-6 border-b border-slate-800/80">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
                <span className="font-extrabold text-white text-base">R</span>
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-200 to-white bg-clip-text text-transparent">RentSafe</span>
                <span className="text-[10px] block font-medium text-indigo-400 tracking-widest uppercase">Decentralized Escrow</span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {sidebarLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600/10 to-violet-600/5 text-indigo-200 border-l-2 border-indigo-500'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-400' : ''}`} />
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Wallet Info */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
          {connected && address ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 uppercase font-semibold">Account</span>
                <button 
                  onClick={copyAddress}
                  className="text-slate-400 hover:text-indigo-400 transition-colors p-1 rounded hover:bg-slate-800"
                >
                  {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/50 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold tracking-tight">{truncateAddress(address)}</span>
                  <span className="text-xs block text-slate-500 font-medium">{balance} XLM</span>
                </div>
                <button 
                  onClick={disconnect}
                  className="text-slate-500 hover:text-rose-400 transition-colors p-1.5 rounded hover:bg-rose-500/10"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowWalletModal(true)}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all duration-300"
            >
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col ml-64 min-h-screen">
        {/* Navbar */}
        <header className="h-20 bg-slate-950/80 border-b border-slate-850/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white capitalize">
              {pathname === '/' ? 'Platform Overview' : pathname.replace('/', '')}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Network Selector */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold">
              <Globe className="h-3.5 w-3.5 text-indigo-400" />
              <select 
                value={network}
                onChange={(e) => setNetwork(e.target.value as 'testnet' | 'local')}
                className="bg-transparent border-none outline-none text-slate-200 cursor-pointer pr-1"
              >
                <option value="testnet" className="bg-slate-900 text-slate-200">Testnet</option>
                <option value="local" className="bg-slate-900 text-slate-200">Local Sandbox</option>
              </select>
            </div>

            {/* Quick Tx Status Indicator */}
            {transactions.length > 0 && (
              <button
                onClick={() => setShowTxCenter(true)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold relative transition-all duration-200 ${
                  activeTxCount > 0 
                    ? 'bg-indigo-950/40 border-indigo-800/80 text-indigo-300 animate-pulse'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${activeTxCount > 0 ? 'animate-spin' : ''}`} />
                <span>Transactions</span>
                {activeTxCount > 0 && (
                  <span className="h-2 w-2 rounded-full bg-indigo-500 absolute -top-0.5 -right-0.5" />
                )}
              </button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 bg-slate-950">
          {children}
        </main>
      </div>

      {/* Wallet Connection Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-white mb-2">Connect Stellar Wallet</h2>
            <p className="text-slate-400 text-sm mb-6">Select your preferred Stellar browser wallet extension to sign Escrow agreements.</p>
            
            {error && (
              <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              {wallets.map((wallet) => (
                <button
                  key={wallet.id}
                  disabled={isConnecting}
                  onClick={async () => {
                    await connect(wallet.id);
                    setShowWalletModal(false);
                  }}
                  className="w-full bg-slate-950 border border-slate-850 hover:border-indigo-500 hover:bg-slate-900/50 p-4 rounded-xl text-left font-semibold flex items-center justify-between group transition-all duration-300 disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{wallet.icon}</span>
                    <span className="text-sm text-slate-200 group-hover:text-white transition-colors">{wallet.name}</span>
                  </div>
                  {isConnecting ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
                  ) : (
                    <span className="text-xs text-slate-500 group-hover:text-indigo-400 transition-colors">Connect →</span>
                  )}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setShowWalletModal(false)}
              className="mt-6 w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Transaction Center Sidebar Drawer */}
      {showTxCenter && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setShowTxCenter(false)}
          />

          {/* Drawer content */}
          <div className="relative w-96 bg-slate-900 border-l border-slate-800 h-full flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-right duration-300">
            <div>
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-white text-lg">Transaction Center</h3>
                <button 
                  onClick={() => setShowTxCenter(false)}
                  className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 text-xs"
                >
                  Close
                </button>
              </div>

              {/* Tx list */}
              <div className="p-4 overflow-y-auto max-h-[calc(100vh-140px)] space-y-3">
                {transactions.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <RefreshCw className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No recent transactions</p>
                  </div>
                ) : (
                  transactions.map((tx) => (
                    <div 
                      key={tx.id} 
                      className={`p-4 rounded-xl border text-sm flex flex-col gap-3 transition-colors duration-300 ${
                        tx.status === 'confirmed' 
                          ? 'bg-green-500/5 border-green-500/10'
                          : tx.status === 'failed'
                          ? 'bg-rose-500/5 border-rose-500/10'
                          : 'bg-indigo-500/5 border-indigo-500/10 animate-pulse'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-semibold text-slate-200">{tx.type}</span>
                          <span className="text-[10px] block text-slate-500 mt-0.5">
                            {new Date(tx.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          tx.status === 'confirmed'
                            ? 'bg-green-500/10 text-green-400'
                            : tx.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-indigo-500/10 text-indigo-400'
                        }`}>
                          {tx.status}
                        </span>
                      </div>

                      {tx.hash && (
                        <div className="flex items-center justify-between text-xs bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                          <span className="text-slate-500 font-mono">Hash: {tx.hash.substring(0, 8)}...</span>
                          <a 
                            href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 hover:underline"
                          >
                            Explorer
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}

                      {tx.error && (
                        <p className="text-xs text-rose-400 bg-rose-500/5 p-2.5 rounded-lg border border-rose-500/10 break-words font-medium">
                          {tx.error}
                        </p>
                      )}

                      {tx.status === 'failed' && tx.retryAction && (
                        <button
                          onClick={() => retry(tx.id)}
                          className="w-full bg-slate-800 hover:bg-slate-700/80 border border-slate-750 text-slate-200 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Retry Transaction
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Clear all */}
            {transactions.length > 0 && (
              <div className="p-4 border-t border-slate-800">
                <button
                  onClick={() => {
                    useTransactionStore.getState().clear();
                  }}
                  className="w-full text-center text-xs text-slate-500 hover:text-rose-400 font-medium transition-colors"
                >
                  Clear Transaction History
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
