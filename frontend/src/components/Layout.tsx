'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWalletStore } from '../state/useWalletStore';
import { useTransactionStore } from '../state/useTransactionStore';
import { 
  ShieldCheck, 
  Settings, 
  Activity, 
  BarChart3, 
  LayoutDashboard, 
  Copy, 
  Check, 
  LogOut, 
  Globe, 
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Search,
  Bell,
  MessageSquare,
  HelpCircle,
  FileText,
  User
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
  const [searchQuery, setSearchQuery] = useState('');

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

  // Render top navbar layout for the Landing Page (WANDER style)
  if (pathname === '/') {
    return (
      <div className="min-h-screen bg-white flex flex-col font-sans antialiased text-[#0f171b]">
        {/* Sticky Header (WANDER style) */}
        <header className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-100 z-30 px-6 lg:px-16 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[#1b8b3a]" />
            <span className="font-sans font-bold text-xl tracking-tight text-[#0f171b]">RentSafe</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <Link href="/" className="text-[#0f171b] font-semibold">Home</Link>
            <a href="#features" className="hover:text-[#0f171b] transition-colors">Features</a>
            <a href="#listings" className="hover:text-[#0f171b] transition-colors">Active Escrows</a>
            <a href="#how-it-works" className="hover:text-[#0f171b] transition-colors">How It Works</a>
          </nav>

          <div className="flex items-center gap-4">
            {connected && address ? (
              <Link 
                href="/dashboard" 
                className="bg-[#0f1717] text-white text-xs font-semibold py-2.5 px-5 rounded-full hover:bg-slate-800 transition-colors"
              >
                Go to Dashboard
              </Link>
            ) : (
              <button 
                onClick={() => setShowWalletModal(true)}
                className="bg-[#0f1717] text-white text-xs font-semibold py-2.5 px-5 rounded-full hover:bg-slate-800 transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-slate-50 border-t border-slate-100 py-12 px-6 lg:px-16 text-center text-sm text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#1b8b3a]" />
              <span className="font-bold text-slate-800">RentSafe</span>
            </div>
            <p className="text-xs">© 2026 RentSafe. Secured by Soroban smart contracts on the Stellar network.</p>
            <div className="flex gap-6 text-xs font-medium">
              <a href="https://stellar.org" target="_blank" rel="noopener noreferrer" className="hover:underline">Stellar Network</a>
              <a href="https://developers.stellar.org" target="_blank" rel="noopener noreferrer" className="hover:underline">Soroban Docs</a>
            </div>
          </div>
        </footer>

        {/* Modals & Drawers */}
        {renderWalletModal()}
      </div>
    );
  }

  // Render left sidebar layout for Dashboard Pages (FINAI style)
  return (
    <div className="min-h-screen bg-[#f4f6f6] flex font-sans antialiased text-[#0f171b]">
      {/* Left Sidebar Menu (FINAI style) */}
      <aside className="w-72 bg-[#f4f6f6] flex flex-col justify-between fixed h-screen z-10 px-6 py-8">
        <div className="flex flex-col h-full justify-between">
          <div>
            {/* Header logo (WANDER logo styled for dashboard) */}
            <div className="flex items-center gap-2 px-3 mb-10">
              <ShieldCheck className="h-6 w-6 text-[#1b8b3a]" />
              <span className="font-sans font-bold text-xl tracking-tight text-[#0f171b]">RENTSAFE</span>
            </div>

            {/* Sidebar Navigation Blocks */}
            <div className="space-y-8">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block px-3 mb-3">Main</span>
                <nav className="space-y-1">
                  <Link 
                    href="/dashboard"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      pathname === '/dashboard'
                        ? 'bg-[#0f1717] text-white'
                        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'
                    }`}
                  >
                    <LayoutDashboard className={`h-4 w-4 ${pathname === '/dashboard' ? 'text-[#1b8b3a]' : ''}`} />
                    Overview
                  </Link>
                  <Link 
                    href="/activity"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      pathname === '/activity'
                        ? 'bg-[#0f1717] text-white'
                        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'
                    }`}
                  >
                    <FileText className={`h-4 w-4 ${pathname === '/activity' ? 'text-[#1b8b3a]' : ''}`} />
                    My Agreements
                  </Link>
                  <Link 
                    href="/analytics"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      pathname === '/analytics'
                        ? 'bg-[#0f1717] text-white'
                        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'
                    }`}
                  >
                    <BarChart3 className={`h-4 w-4 ${pathname === '/analytics' ? 'text-[#1b8b3a]' : ''}`} />
                    Analytics
                  </Link>
                </nav>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block px-3 mb-3">Money Control</span>
                <nav className="space-y-1">
                  <Link 
                    href="/settings"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      pathname === '/settings'
                        ? 'bg-[#0f1717] text-white'
                        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'
                    }`}
                  >
                    <Settings className={`h-4 w-4 ${pathname === '/settings' ? 'text-[#1b8b3a]' : ''}`} />
                    Settings
                  </Link>
                </nav>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block px-3 mb-3">Others</span>
                <nav className="space-y-1">
                  <a 
                    href="https://developers.stellar.org" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 transition-all duration-200"
                  >
                    <HelpCircle className="h-4 w-4" />
                    Help
                  </a>
                  {connected && (
                    <button 
                      onClick={disconnect}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200 text-left"
                    >
                      <LogOut className="h-4 w-4 text-rose-500" />
                      Disconnect
                    </button>
                  )}
                </nav>
              </div>
            </div>
          </div>

          {/* AI Assistant Bubble (FINAI mockup style) */}
          <div className="bg-[#eef2f2] p-4 rounded-2xl border border-slate-200/80 mt-auto space-y-3">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-[#1b8b3a]" />
              <span className="text-xs font-bold text-slate-800">AI Assistant</span>
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
            </div>
            
            <div className="relative">
              <input 
                type="text" 
                placeholder="Ask me anything..." 
                className="w-full bg-white text-xs py-2 pl-3 pr-8 rounded-xl border border-slate-200 focus:outline-none focus:border-[#1b8b3a] transition-all"
              />
              <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#1b8b3a] font-bold text-xs">
                →
              </button>
            </div>

            <div className="flex gap-2">
              <span className="bg-white/80 border border-slate-200 text-[10px] text-slate-500 px-2 py-0.5 rounded-lg font-medium cursor-pointer hover:bg-white transition-colors">
                Escrow Rules
              </span>
              <span className="bg-white/80 border border-slate-200 text-[10px] text-slate-500 px-2 py-0.5 rounded-lg font-medium cursor-pointer hover:bg-white transition-colors">
                Disputes
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame (FINAI styled header + body) */}
      <div className="flex-1 flex flex-col pl-72 min-h-screen">
        {/* Dashboard Top bar navigation & welcome (FINAI style) */}
        <header className="h-24 px-8 lg:px-12 flex items-center justify-between sticky top-0 z-20 bg-[#f4f6f6]/95 backdrop-blur-md">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              {connected && address ? (
                <>Welcome, {truncateAddress(address)} 👋</>
              ) : (
                <>Welcome, Guest 👋</>
              )}
            </h1>
            <span className="text-xs text-slate-500 block font-medium mt-0.5">Here is your escrow overview for today</span>
          </div>

          <div className="flex items-center gap-6">
            {/* Search Input bar */}
            <div className="relative hidden md:block">
              <input 
                type="text" 
                placeholder="Search agreements..." 
                className="bg-white/80 border border-slate-200 text-xs py-2 pl-8 pr-4 rounded-xl focus:outline-none focus:border-[#1b8b3a] w-52 transition-all"
              />
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>

            {/* Network Toggle dropdown */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-sm">
              <Globe className="h-3.5 w-3.5 text-[#1b8b3a]" />
              <select 
                value={network}
                onChange={(e) => setNetwork(e.target.value as 'testnet' | 'local')}
                className="bg-transparent border-none outline-none text-slate-700 cursor-pointer pr-1"
              >
                <option value="testnet" className="bg-white">Testnet</option>
                <option value="local" className="bg-white">Sandbox</option>
              </select>
            </div>

            {/* Transaction Alert Button */}
            <button 
              onClick={() => setShowTxCenter(true)}
              className="relative p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Bell className="h-4 w-4" />
              {activeTxCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </button>

            {/* Profile Avatar (Mocks FINAI avatar) */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 font-bold overflow-hidden shadow-sm">
                <User className="h-5 w-5" />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Workspace body */}
        <main className="flex-1 px-8 lg:px-12 pb-12">
          {children}
        </main>
      </div>

      {/* Shared Modals and transaction drawer */}
      {renderWalletModal()}
      {renderTxCenterDrawer()}
    </div>
  );

  // Helper render method for the wallet connection modal
  function renderWalletModal() {
    if (!showWalletModal) return null;
    return (
      <div className="fixed inset-0 bg-[#0f1717]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white border border-slate-200/80 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-slate-800">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Connect Wallet</h2>
          <p className="text-slate-400 text-xs mb-6">Select your preferred Stellar browser wallet extension to sign Escrow agreements.</p>
          
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs flex items-start gap-2">
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
                className="w-full bg-[#f4f6f6] border border-slate-200/60 hover:bg-slate-100 p-4 rounded-2xl text-left font-semibold flex items-center justify-between group transition-all duration-300 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{wallet.icon}</span>
                  <span className="text-sm text-slate-700 group-hover:text-slate-950 transition-colors font-semibold">{wallet.name}</span>
                </div>
                {isConnecting ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />
                ) : (
                  <span className="text-xs text-slate-400 group-hover:text-[#1b8b3a] transition-colors">Connect →</span>
                )}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setShowWalletModal(false)}
            className="mt-6 w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Helper render method for Transaction Center sidebar drawer
  function renderTxCenterDrawer() {
    if (!showTxCenter) return null;
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-[#0f1717]/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowTxCenter(false)}
        />

        {/* Drawer content */}
        <div className="relative w-96 bg-white border-l border-slate-200 h-full flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-right duration-300 text-slate-800">
          <div>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-lg">Transaction Center</h3>
              <button 
                onClick={() => setShowTxCenter(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            {/* Tx list */}
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-140px)] space-y-3">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <RefreshCw className="h-8 w-8 mx-auto mb-3 opacity-30 text-slate-300" />
                  <p className="text-sm font-medium">No recent transactions</p>
                </div>
              ) : (
                transactions.map((tx) => (
                  <div 
                    key={tx.id} 
                    className={`p-4 rounded-2xl border text-sm flex flex-col gap-3 transition-colors duration-300 ${
                      tx.status === 'confirmed' 
                        ? 'bg-green-50/50 border-green-200 text-slate-800'
                        : tx.status === 'failed'
                        ? 'bg-red-50/50 border-red-200 text-slate-800'
                        : 'bg-blue-50/50 border-blue-200 animate-pulse'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-semibold text-slate-800">{tx.type}</span>
                        <span className="text-[10px] block text-slate-400 mt-0.5 font-medium">
                          {new Date(tx.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        tx.status === 'confirmed'
                          ? 'bg-green-100 text-green-700'
                          : tx.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {tx.status}
                      </span>
                    </div>

                    {tx.hash && (
                      <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-slate-500 font-mono">Hash: {tx.hash.substring(0, 8)}...</span>
                        <a 
                          href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1b8b3a] hover:text-[#156c2d] font-bold flex items-center gap-1 hover:underline"
                        >
                          Explorer
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}

                    {tx.error && (
                      <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200 break-words font-medium">
                        {tx.error}
                      </p>
                    )}

                    {tx.status === 'failed' && tx.retryAction && (
                      <button
                        onClick={() => retry(tx.id)}
                        className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
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
            <div className="p-4 border-t border-slate-100">
              <button
                onClick={() => {
                  useTransactionStore.getState().clear();
                }}
                className="w-full text-center text-xs text-slate-400 hover:text-red-500 font-bold transition-colors"
              >
                Clear Transaction History
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
}
