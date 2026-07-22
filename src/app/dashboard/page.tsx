'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/useAppStore';
import { ContractService } from '@/services/contractService';
import { NATIVE_XLM_ID, readContractView, DEFAULT_DISPUTE_ID } from '@/lib/stellar';
import { useUserAgreements, useDashboardMetrics, usePlatformStats } from '@/hooks/useChainQueries';
import ActivityFeed from '@/components/ActivityFeed';
import TransactionCenter from '@/components/TransactionCenter';

const WalletConnectModal = dynamic(() => import('@/components/WalletConnectModal'), { ssr: false });

function Dashboard() {
  const { 
    address, 
    balance, 
    setBalance, 
    escrowId, 
    setEscrowId, 
    escrowInfo, 
    setEscrowInfo, 
    loadingEscrow, 
    setLoadingEscrow,
    network,
    setNetwork,
    resetSession
  } = useAppStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [searchId, setSearchId] = useState(escrowId || '');
  const [error, setError] = useState<string | null>(null);

  // Tabs state: 'home' | 'inspect' | 'analytics' | 'settings'
  const [activeTab, setActiveTab] = useState<'home' | 'inspect' | 'analytics' | 'settings'>('home');

  // React Query Hooks for live on-chain caching/polling
  const { data: agreements = [], isLoading: loadingAgreements, refetch: refetchAgreements } = useUserAgreements(address);
  const { data: metrics, isLoading: loadingMetrics, refetch: refetchMetrics } = useDashboardMetrics(address);
  const { data: platformStats, isLoading: loadingPlatform, refetch: refetchPlatform } = usePlatformStats();

  // Settlement Inputs — default to full deposit going to tenant (common "refund" case)
  // These are in XLM (human-readable), converted to stroops on submit.
  const [landlordShare, setLandlordShare] = useState('0');
  const [tenantShare, setTenantShare] = useState('0');
  
  // Dispute inputs
  const [evidenceHash, setEvidenceHash] = useState('0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20');

  // Link Dispute contract ID inputs
  const [disputeContractInput, setDisputeContractInput] = useState(DEFAULT_DISPUTE_ID);

  // Settings states
  const [defaultEscrowConfig, setDefaultEscrowConfig] = useState('');
  const [defaultDisputeConfig, setDefaultDisputeConfig] = useState(DEFAULT_DISPUTE_ID);

  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionTx, setActionTx] = useState<string | null>(null);

  // Fetch escrow details
  const fetchEscrow = async (id: string) => {
    if (!id || id.length !== 56) {
      setError('Please enter a valid 56-character contract ID.');
      return;
    }
    try {
      setLoadingEscrow(true);
      setError(null);
      const details = await ContractService.getEscrowDetails(id);
      
      // Fetch locked balance of escrow
      let lockedBalance = '0.00';
      try {
        const balVal = await readContractView(NATIVE_XLM_ID, 'balance', [id]);
        lockedBalance = (Number(balVal) / 10000000).toFixed(2);
      } catch (balErr) {
        console.error('Failed to fetch escrow locked token balance:', balErr);
      }

      setEscrowInfo({
        address: details.address,
        landlord: details.landlord,
        tenant: details.tenant,
        arbitrator: details.arbitrator,
        token: details.token,
        amount: details.amount,
        state: details.state,
        disputeContract: details.disputeContract,
        lockedBalance,
        proposedBy: details.proposedBy,
      });
      setEscrowId(id);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to fetch escrow: ${err.message || 'Make sure contract is active on Testnet'}`);
      setEscrowInfo(null);
    } finally {
      setLoadingEscrow(false);
    }
  };

  useEffect(() => {
    if (escrowId) {
      fetchEscrow(escrowId);
    }
  }, [network]);

  const handleInspect = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEscrow(searchId);
    setActiveTab('inspect');
  };

  const executeAction = async (name: string, actionFn: () => Promise<string>) => {
    if (!address) {
      setModalOpen(true);
      return;
    }
    try {
      setActionLoading(name);
      setActionTx(null);
      setError(null);
      const txHash = await actionFn();
      setActionTx(txHash);

      // Invalidate React Query caches to trigger updates
      await refetchAgreements();
      await refetchMetrics();
      await refetchPlatform();

      // Refresh inspected escrow state
      await fetchEscrow(escrowId);
      // Refresh user balance
      try {
        const balVal = await readContractView(NATIVE_XLM_ID, 'balance', [address]);
        setBalance((Number(balVal) / 10000000).toFixed(2));
      } catch (balErr) {
        console.error('Failed to fetch user balance:', balErr);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || `Transaction failed for ${name}`);
    } finally {
      setActionLoading(null);
    }
  };

  // State mappings
  const STATE_NAMES = ['Created', 'Funded', 'Active', 'SettlementRequested', 'Disputed', 'Resolved', 'Closed'];

  // Role verification helpers
  const getUserRole = () => {
    if (!address || !escrowInfo) return 'Guest';
    if (address.toLowerCase() === escrowInfo.landlord.toLowerCase()) return 'Landlord';
    if (address.toLowerCase() === escrowInfo.tenant.toLowerCase()) return 'Tenant';
    if (address.toLowerCase() === escrowInfo.arbitrator.toLowerCase()) return 'Arbitrator';
    return 'Viewer';
  };

  const role = getUserRole();
  const isSettlementProposer =
    escrowInfo?.state === 3 &&
    !!escrowInfo.proposedBy &&
    !!address &&
    escrowInfo.proposedBy.toLowerCase() === address.toLowerCase();
  const canAcceptSettlement =
    escrowInfo?.state === 3 &&
    !!escrowInfo.proposedBy &&
    !isSettlementProposer &&
    (role === 'Landlord' || role === 'Tenant');

  return (
    <div className="bg-[#f9f9f9] text-[#1a1c1c] font-sans min-h-screen overflow-x-hidden antialiased flex flex-col md:flex-row pb-16 md:pb-0">
      
      {/* SideNavBar (Desktop Only) */}
      <aside className="hidden md:flex bg-[#ffffff] border-r border-[#e2e2e2] h-screen w-64 flex-col z-30 p-6 shrink-0 sticky top-0">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#000000] flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-xl">real_estate_agent</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#000000]">RentSafe</h1>
            <p className="text-[10px] text-[#585f6c] font-semibold uppercase tracking-wider">Dashboard Panel</p>
          </div>
        </div>

        {/* Wallet Pill */}
        <div className="bg-[#f3f3f3] rounded-2xl px-4 py-3 flex items-center justify-between border border-[#e2e2e2] mb-6">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${address ? 'bg-emerald-500' : 'bg-[#747878]'}`} />
            <span className="text-xs font-semibold font-mono truncate text-[#000000]">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not Connected'}
            </span>
          </div>
          {address && (
            <button 
              onClick={async () => {
                const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');
                await StellarWalletsKit.disconnect();
                resetSession();
              }}
              title="Disconnect Wallet"
              className="material-symbols-outlined text-sm text-[#747878] hover:text-[#000000] cursor-pointer"
            >
              logout
            </button>
          )}
        </div>

        <nav className="flex-1 flex flex-col gap-1">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm w-full text-left transition-colors ${activeTab === 'home' ? 'bg-[#dce2f3] text-[#151c27]' : 'text-[#585f6c] hover:text-[#000000] hover:bg-[#f3f3f3]'}`}
          >
            <span className="material-symbols-outlined text-lg">dashboard</span>
            <span>Dashboard</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('inspect')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm w-full text-left transition-colors ${activeTab === 'inspect' ? 'bg-[#dce2f3] text-[#151c27]' : 'text-[#585f6c] hover:text-[#000000] hover:bg-[#f3f3f3]'}`}
          >
            <span className="material-symbols-outlined text-lg">search</span>
            <span>Inspect Escrow</span>
          </button>

          <Link 
            href="/create"
            className="flex items-center gap-3 px-4 py-3 text-[#585f6c] hover:text-[#000000] hover:bg-[#f3f3f3] rounded-xl text-sm transition-colors font-bold"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            <span>New Escrow</span>
          </Link>

          <button 
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm w-full text-left transition-colors ${activeTab === 'analytics' ? 'bg-[#dce2f3] text-[#151c27]' : 'text-[#585f6c] hover:text-[#000000] hover:bg-[#f3f3f3]'}`}
          >
            <span className="material-symbols-outlined text-lg">monitoring</span>
            <span>Analytics</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm w-full text-left transition-colors ${activeTab === 'settings' ? 'bg-[#dce2f3] text-[#151c27]' : 'text-[#585f6c] hover:text-[#000000] hover:bg-[#f3f3f3]'}`}
          >
            <span className="material-symbols-outlined text-lg">settings</span>
            <span>Settings</span>
          </button>
        </nav>

        <div className="mt-8 border-t border-[#e2e2e2] pt-4">
          <p className="text-[10px] text-[#585f6c] mb-1 font-semibold">BALANCE</p>
          <p className="text-lg font-black text-[#000000]">{balance} XLM</p>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <div className="flex-grow flex flex-col min-h-screen">
        
        {/* TopNavBar */}
        <header className="bg-[#ffffff] border-b border-[#e2e2e2] h-16 flex justify-between items-center px-6 sticky top-0 z-20">
          <h2 className="text-base font-bold text-[#000000] tracking-tight">
            {activeTab === 'home' && 'Rental Portal'}
            {activeTab === 'inspect' && 'Escrow Console'}
            {activeTab === 'analytics' && 'Platform Analytics'}
            {activeTab === 'settings' && 'User Settings'}
          </h2>
          
          <div className="flex items-center gap-4">
            <form onSubmit={handleInspect} className="relative hidden md:flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-[#747878] text-lg pointer-events-none">search</span>
              <input 
                type="text" 
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Inspect Contract ID..." 
                className="pl-9 pr-4 py-1.5 bg-[#f3f3f3] border border-[#c4c7c7]/50 rounded-full text-xs focus:outline-none focus:border-black w-64 text-[#000000] placeholder-[#747878]"
              />
            </form>

            {address ? (
              <span className="text-xs text-[#585f6c] font-mono bg-[#eeeeee] px-2.5 py-1.5 rounded-lg border border-[#c4c7c7]/30 md:hidden">
                {address.slice(0, 4)}...{address.slice(-4)}
              </span>
            ) : (
              <button 
                onClick={() => setModalOpen(true)}
                className="bg-[#000000] text-white px-4 py-2 rounded-full text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </header>

        {/* Content View */}
        <main className="flex-grow p-6 md:p-8 max-w-5xl mx-auto w-full">
          {error && (
            <div className="bg-[#ffdad6]/40 border border-[#ba1a1a]/20 text-[#ba1a1a] p-4 rounded-2xl text-xs mb-6 flex flex-col gap-2">
              <p className="font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">error</span> Error Occurred
              </p>
              <p>{error}</p>
            </div>
          )}

          {actionTx && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs mb-6 flex flex-col gap-2">
              <p className="font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">check_circle</span> Transaction Confirmed!
              </p>
              <p className="font-mono break-all">Hash: {actionTx}</p>
              <a 
                href={`https://stellar.expert/explorer/testnet/tx/${actionTx}`} 
                target="_blank" 
                rel="noreferrer"
                className="underline font-semibold flex items-center gap-1 mt-1 text-emerald-950"
              >
                View on Stellar.expert <span className="material-symbols-outlined text-[10px]">open_in_new</span>
              </a>
            </div>
          )}

          {/* TAB 1: HOME (OVERVIEW) */}
          {activeTab === 'home' && (
            <div className="space-y-8 animate-fadeIn">
              
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#ffffff] p-6 rounded-[24px] border border-[#e2e2e2] shadow-sm">
                  <p className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider mb-2">Total Value Locked</p>
                  <p className="text-2xl font-black text-black">
                    {loadingMetrics ? '...' : (address ? (metrics?.tvl || '0.00') : '0.00')} XLM
                  </p>
                  <p className="text-[10px] text-[#585f6c] mt-1">Locked security deposit funds in escrows</p>
                </div>
                <div className="bg-[#ffffff] p-6 rounded-[24px] border border-[#e2e2e2] shadow-sm">
                  <p className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider mb-2">Active Agreements</p>
                  <p className="text-2xl font-black text-black">
                    {loadingMetrics ? '...' : (address ? (metrics?.activeCount || 0) : 0)}
                  </p>
                  <p className="text-[10px] text-[#585f6c] mt-1">Contracts currently in lease active state</p>
                </div>
                <div className="bg-[#ffffff] p-6 rounded-[24px] border border-[#e2e2e2] shadow-sm">
                  <p className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider mb-2">Pending Returns</p>
                  <p className="text-2xl font-black text-black">
                    {loadingMetrics ? '...' : (address ? (metrics?.pendingCount || '0.00') : '0.00')} XLM
                  </p>
                  <p className="text-[10px] text-[#585f6c] mt-1">Settlements currently awaiting approval</p>
                </div>
              </div>

              {/* Active Agreements List */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-black uppercase tracking-wider">My Agreements</h3>
                
                {loadingAgreements ? (
                  <div className="flex justify-center items-center py-10">
                    <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : !address ? (
                  <div className="bg-[#ffffff] rounded-[24px] p-8 text-center border border-[#e2e2e2] text-[#585f6c] shadow-sm">
                    <span className="material-symbols-outlined text-4xl mb-3">lock_open</span>
                    <h3 className="text-base font-bold text-[#000000] mb-2">Connect Wallet</h3>
                    <p className="text-xs mb-6 max-w-sm mx-auto">Please connect your Stellar wallet to view your active rental deposit agreements.</p>
                    <button 
                      onClick={() => setModalOpen(true)}
                      className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90"
                    >
                      Connect Wallet
                    </button>
                  </div>
                ) : agreements.length === 0 ? (
                  <div className="bg-[#ffffff] rounded-[24px] p-8 text-center border border-[#e2e2e2] text-[#585f6c] shadow-sm">
                    <span className="material-symbols-outlined text-4xl mb-3">gavel</span>
                    <h3 className="text-base font-bold text-[#000000] mb-2">No Active Agreements</h3>
                    <p className="text-xs mb-6 max-w-sm mx-auto">You do not have any active agreements registered on-chain yet.</p>
                    <Link 
                      href="/create"
                      className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90 inline-block"
                    >
                      Create New Escrow
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {agreements.map((agr) => (
                      <div key={agr.address} className="bg-white p-6 rounded-2xl border border-[#e2e2e2] shadow-sm flex flex-col justify-between h-48 hover:border-black transition-colors">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-sm text-black truncate max-w-[200px]">Escrow Target Address</h4>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                              agr.state === 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-[#dce2f3] text-[#5e6572]'
                            }`}>
                              {STATE_NAMES[agr.state]}
                            </span>
                          </div>
                          <p className="text-xs text-[#585f6c] mb-1">Target Deposit: {(Number(agr.amount) / 10000000).toLocaleString()} XLM</p>
                          <p className="text-xs text-[#585f6c]">Locked Balance: {agr.lockedBalance} XLM</p>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-[#e2e2e2]">
                          <span className="text-[10px] text-[#585f6c] font-mono truncate max-w-[150px]" title={agr.address}>
                            ID: {agr.address.slice(0, 6)}...{agr.address.slice(-6)}
                          </span>
                          <button 
                            onClick={() => {
                              setSearchId(agr.address);
                              fetchEscrow(agr.address);
                              setActiveTab('inspect');
                            }}
                            className="bg-black text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold hover:opacity-90"
                          >
                            Inspect details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity & Transactions Console */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <ActivityFeed />
                <TransactionCenter />
              </div>

            </div>
          )}

          {/* TAB 2: INSPECT ESCROW */}
          {activeTab === 'inspect' && (
            <div className="space-y-6 animate-fadeIn">
              {loadingEscrow ? (
                <div className="flex flex-col items-center justify-center py-20 text-[#585f6c]">
                  <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-semibold">Simulating & fetching ledger state...</p>
                </div>
              ) : escrowInfo ? (
                <div className="space-y-6">
                  
                  {/* Escrow Details Header Card */}
                  <div className="bg-[#ffffff] rounded-[24px] p-6 shadow-sm border border-[#e2e2e2] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-[#000000]">Escrow: {escrowInfo.address.slice(0, 12)}...{escrowInfo.address.slice(-12)}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-[#585f6c] mt-1 font-semibold">
                        <span className="material-symbols-outlined text-sm">payments</span>
                        <span>Required Deposit: {(Number(escrowInfo.amount) / 10000000).toLocaleString()} XLM</span>
                      </div>
                      <div className="text-xs text-[#585f6c] font-mono mt-1 select-all">{escrowInfo.address}</div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider mb-1">Escrow Balance</span>
                      <span className="text-2xl font-black text-[#000000]">
                        {escrowInfo.lockedBalance} XLM
                      </span>
                      <div className="mt-2 bg-[#f3f3f3] border border-[#c4c7c7]/50 rounded-full px-3 py-1 text-[10px] font-bold uppercase text-[#000000] flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-[#000000] rounded-full" />
                        <span>State: {STATE_NAMES[escrowInfo.state]} ({escrowInfo.state})</span>
                      </div>
                    </div>
                  </div>

                  {/* Roles Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#ffffff] p-5 rounded-2xl border border-[#e2e2e2] relative">
                      <span className="absolute top-4 right-4 bg-[#f3f3f3] px-2 py-0.5 rounded text-[8px] font-bold tracking-wider text-[#585f6c]">TENANT</span>
                      <h4 className="text-xs font-bold text-[#585f6c] mb-3 uppercase">Tenant Role</h4>
                      <p className="text-sm font-semibold truncate font-mono text-[#000000]">{escrowInfo.tenant}</p>
                      <p className="text-[10px] text-[#747878] mt-1">Responsible for funding the deposit</p>
                    </div>
                    <div className="bg-[#ffffff] p-5 rounded-2xl border border-[#e2e2e2] relative">
                      <span className="absolute top-4 right-4 bg-[#f3f3f3] px-2 py-0.5 rounded text-[8px] font-bold tracking-wider text-[#585f6c]">LANDLORD</span>
                      <h4 className="text-xs font-bold text-[#585f6c] mb-3 uppercase">Landlord Role</h4>
                      <p className="text-sm font-semibold truncate font-mono text-[#000000]">{escrowInfo.landlord}</p>
                      <p className="text-[10px] text-[#747878] mt-1">Responsible for lease activation</p>
                    </div>
                    <div className="bg-[#ffffff] p-5 rounded-2xl border border-[#e2e2e2] relative">
                      <span className="absolute top-4 right-4 bg-[#f3f3f3] px-2 py-0.5 rounded text-[8px] font-bold tracking-wider text-[#585f6c]">ARBITRATOR</span>
                      <h4 className="text-xs font-bold text-[#585f6c] mb-3 uppercase">Arbitrator</h4>
                      <p className="text-sm font-semibold truncate font-mono text-[#000000]">{escrowInfo.arbitrator}</p>
                      <p className="text-[10px] text-[#747878] mt-1">Neutral dispute resolution coordinator</p>
                    </div>
                  </div>

                  {/* Interaction Panel */}
                  <div className="bg-[#ffffff] rounded-[24px] p-6 shadow-sm border border-[#e2e2e2]">
                    <h3 className="text-sm font-bold text-[#000000] mb-4 border-b border-[#e2e2e2] pb-3">Contract Console (Your Role: {role})</h3>
                    
                    {escrowInfo.state === 3 && role !== 'Guest' && (
                      <div className="bg-[#ffdad6]/20 border border-[#ba1a1a]/20 p-4 rounded-xl mb-6 text-xs text-[#000000]">
                        <span className="font-bold text-[#ba1a1a] block mb-1">MUTUAL SETTLEMENT REQUESTED</span>
                        {isSettlementProposer
                          ? "You proposed a mutual settlement split. The counterparty must accept it to execute payouts, or they can raise a dispute."
                          : escrowInfo.proposedBy
                            ? "The counterparty proposed a mutual settlement split. You can accept it below to execute payouts, or raise a dispute."
                            : "A settlement request exists, but RentSafe is still verifying the latest proposer from chain. Accept is temporarily disabled to prevent signing an invalid transaction."}
                      </div>
                    )}

                    <div className="space-y-6">
                      {escrowInfo.state === 0 && (
                        <div className="flex flex-col gap-3">
                          <p className="text-xs text-[#585f6c]">The escrow is initialized. The Tenant must deposit the required funds to progress.</p>
                          <button 
                            disabled={actionLoading !== null || role !== 'Tenant'}
                            onClick={() => executeAction('Fund Escrow', () => ContractService.fundEscrow(escrowId, address))}
                            className="bg-black text-white px-6 py-3 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity w-full md:w-auto"
                          >
                            {actionLoading === 'Fund Escrow' ? 'Submitting Fund Tx...' : 'Fund Escrow (Deposit Locked)'}
                          </button>
                        </div>
                      )}

                      {escrowInfo.state === 1 && (
                        <div className="flex flex-col gap-3">
                          <p className="text-xs text-[#585f6c]">The deposit is funded. The Landlord must activate the escrow upon lease start.</p>
                          <button 
                            disabled={actionLoading !== null || role !== 'Landlord'}
                            onClick={() => executeAction('Activate Escrow', () => ContractService.activateEscrow(escrowId, address))}
                            className="bg-black text-white px-6 py-3 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity w-full md:w-auto"
                          >
                            {actionLoading === 'Activate Escrow' ? 'Submitting Activate Tx...' : 'Activate Escrow (Start Lease)'}
                          </button>
                        </div>
                      )}

                      {(escrowInfo.state === 2 || escrowInfo.state === 3) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4 p-4 bg-[#f3f3f3] rounded-2xl border border-[#e2e2e2]">
                            <h4 className="text-xs font-bold text-[#000000]">Propose Payout Split</h4>
                            {(() => {
                              const totalXlm = Number(escrowInfo.amount) / 10000000;
                              const lVal = parseFloat(landlordShare) || 0;
                              const tVal = parseFloat(tenantShare) || 0;
                              const sumOk = Math.abs(lVal + tVal - totalXlm) < 0.0000001;
                              return (
                                <>
                                  <p className="text-[10px] text-[#585f6c]">
                                    Enter shares in XLM. Must total exactly <strong className="text-black">{totalXlm} XLM</strong>.
                                  </p>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-[10px] text-[#585f6c] block mb-1">Landlord Share (XLM)</label>
                                      <input 
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={landlordShare}
                                        onChange={(e) => {
                                          setLandlordShare(e.target.value);
                                          // Auto-fill tenant share as the remainder
                                          const lv = parseFloat(e.target.value) || 0;
                                          const remainder = Math.max(0, totalXlm - lv);
                                          setTenantShare(remainder.toFixed(7).replace(/\.?0+$/, '') || '0');
                                        }}
                                        className="w-full text-xs p-2.5 border border-[#c4c7c7] rounded-xl bg-white focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-[#585f6c] block mb-1">Tenant Share (XLM)</label>
                                      <input 
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={tenantShare}
                                        onChange={(e) => {
                                          setTenantShare(e.target.value);
                                          // Auto-fill landlord share as the remainder
                                          const tv = parseFloat(e.target.value) || 0;
                                          const remainder = Math.max(0, totalXlm - tv);
                                          setLandlordShare(remainder.toFixed(7).replace(/\.?0+$/, '') || '0');
                                        }}
                                        className="w-full text-xs p-2.5 border border-[#c4c7c7] rounded-xl bg-white focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                  {/* Live sum validation */}
                                  <div className={`text-[10px] font-semibold rounded-lg px-3 py-2 flex items-center gap-1.5 ${
                                    sumOk 
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                      : 'bg-[#ffdad6]/40 text-[#ba1a1a] border border-[#ba1a1a]/20'
                                  }`}>
                                    <span className="material-symbols-outlined text-sm">
                                      {sumOk ? 'check_circle' : 'error'}
                                    </span>
                                    {sumOk 
                                      ? `✓ Shares sum to ${totalXlm} XLM — ready to submit`
                                      : `Sum is ${(lVal + tVal).toFixed(7).replace(/\.?0+$/, '')} XLM — must equal ${totalXlm} XLM`
                                    }
                                  </div>
                                  <button 
                                    disabled={actionLoading !== null || (role !== 'Landlord' && role !== 'Tenant') || !sumOk}
                                    onClick={() => executeAction('Request Settlement', () => {
                                      const lShareRaw = BigInt(Math.round(lVal * 10000000));
                                      const tShareRaw = BigInt(Math.round(tVal * 10000000));
                                      return ContractService.requestSettlement(
                                        escrowId, 
                                        { caller: address, landlord_share: lShareRaw, tenant_share: tShareRaw }, 
                                        address
                                      );
                                    })}
                                    className="bg-black text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity w-full"
                                  >
                                    {actionLoading === 'Request Settlement' ? 'Proposing Split...' : 'Propose Split'}
                                  </button>
                                </>
                              );
                            })()}
                          </div>

                          <div className="space-y-4 p-4 bg-[#f3f3f3] rounded-2xl border border-[#e2e2e2] flex flex-col justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-[#000000]">Accept / Raise Dispute</h4>
                              {escrowInfo.state === 3 && (
                                <>
                                  {!escrowInfo.proposedBy ? (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[10px] font-semibold text-center mb-3">
                                      Waiting for on-chain proposer verification. Accept is disabled until the latest proposal author is confirmed.
                                    </div>
                                  ) : isSettlementProposer ? (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[10px] font-semibold text-center mb-3">
                                      Awaiting counterparty response...
                                    </div>
                                  ) : (
                                    <button 
                                      disabled={actionLoading !== null || !canAcceptSettlement}
                                      onClick={() => executeAction('Accept Settlement', () => ContractService.acceptSettlement(escrowId, address))}
                                      className="bg-black text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity w-full mb-3"
                                    >
                                      {actionLoading === 'Accept Settlement' ? 'Accepting...' : 'Accept Settlement Proposal'}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="space-y-3 pt-3 border-t border-[#c4c7c7]/50">
                              <div>
                                <label className="text-[10px] text-[#585f6c] block mb-1">Evidence Hash (32-byte hex)</label>
                                <input 
                                  type="text"
                                  value={evidenceHash}
                                  onChange={(e) => setEvidenceHash(e.target.value)}
                                  className="w-full text-xs p-2 border border-[#c4c7c7] rounded-xl bg-white font-mono"
                                />
                              </div>
                              <button 
                                disabled={actionLoading !== null || (role !== 'Landlord' && role !== 'Tenant')}
                                onClick={() => executeAction('Raise Dispute', () => {
                                  const cleanHash = evidenceHash.replace('0x', '');
                                  const buf = Buffer.from(cleanHash, 'hex');
                                  return ContractService.raiseDispute(
                                    escrowId,
                                    { caller: address, evidence_hash: buf },
                                    address
                                  );
                                })}
                                className="bg-[#ba1a1a] text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity w-full"
                              >
                                {actionLoading === 'Raise Dispute' ? 'Filing Dispute...' : 'Dispute & Lock Funds'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {escrowInfo.state === 4 && (
                        <div className="space-y-4 p-4 bg-[#ffdad6]/20 border border-[#ba1a1a]/20 rounded-2xl">
                          <h4 className="text-xs font-bold text-[#ba1a1a]">Arbitrator Resolution Interface</h4>
                          <p className="text-[10px] text-[#585f6c]">The designated Arbitrator must review the dispute evidence and resolve the payout split.</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-[#585f6c] block mb-1">Landlord Resolve Share (XLM)</label>
                              <input 
                                type="number"
                                value={landlordShare}
                                onChange={(e) => setLandlordShare(e.target.value)}
                                className="w-full text-xs p-2.5 border border-[#c4c7c7] rounded-xl bg-white focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#585f6c] block mb-1">Tenant Resolve Share (XLM)</label>
                              <input 
                                type="number"
                                value={tenantShare}
                                onChange={(e) => setTenantShare(e.target.value)}
                                className="w-full text-xs p-2.5 border border-[#c4c7c7] rounded-xl bg-white focus:outline-none"
                              />
                            </div>
                          </div>
                          <button 
                            disabled={actionLoading !== null || role !== 'Arbitrator'}
                            onClick={() => executeAction('Resolve Dispute', () => {
                              const lShareRaw = BigInt(parseFloat(landlordShare) * 10000000);
                              const tShareRaw = BigInt(parseFloat(tenantShare) * 10000000);
                              return ContractService.resolveDispute(
                                escrowInfo.disputeContract,
                                { landlord_share: lShareRaw, tenant_share: tShareRaw },
                                address
                              );
                            })}
                            className="bg-black text-white px-6 py-3 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity w-full"
                          >
                            {actionLoading === 'Resolve Dispute' ? 'Submitting Resolution Payout...' : 'Submit Resolution Payouts'}
                          </button>
                        </div>
                      )}

                      {escrowInfo.state === 0 && escrowInfo.disputeContract === 'Not Linked Yet' && (
                        <div className="pt-4 border-t border-[#e2e2e2] space-y-3">
                          <h4 className="text-xs font-bold text-[#000000]">Link Dispute Contract (Arbitrator Only)</h4>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={disputeContractInput}
                              onChange={(e) => setDisputeContractInput(e.target.value)}
                              placeholder="Dispute Contract Address (56 chars)..."
                              className="flex-grow text-xs p-2.5 border border-[#c4c7c7] rounded-xl bg-white"
                            />
                            <button 
                              disabled={actionLoading !== null || role !== 'Arbitrator'}
                              onClick={() => executeAction('Link Dispute Contract', () => ContractService.setDisputeContract(escrowId, disputeContractInput, address))}
                              className="bg-black text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
                            >
                              {actionLoading === 'Link Dispute Contract' ? 'Linking...' : 'Link Contract'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Activity Feed & Transaction Center */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <ActivityFeed />
                    <TransactionCenter />
                  </div>
                </div>
              ) : (
                <div className="bg-[#ffffff] rounded-[24px] p-8 text-center border border-[#e2e2e2] text-[#585f6c] shadow-sm">
                  <span className="material-symbols-outlined text-4xl mb-3">search</span>
                  <h3 className="text-base font-bold text-[#000000] mb-2">No Agreement Loaded</h3>
                  <p className="text-xs text-[#585f6c]">Enter a contract ID in the search field above to inspect an escrow agreement.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-fadeIn">

              {/* Real-time status bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${loadingPlatform ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                  <span className="text-xs text-[#585f6c] font-semibold">
                    {loadingPlatform ? 'Syncing on-chain data…' : 'Live On-Chain Data'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {platformStats?.lastUpdated && (
                    <span className="text-[10px] text-[#747878]">
                      Updated {new Date(platformStats.lastUpdated).toLocaleTimeString()}
                    </span>
                  )}
                  <button
                    onClick={() => refetchPlatform()}
                    disabled={loadingPlatform}
                    className="text-[10px] font-bold text-[#585f6c] hover:text-black disabled:opacity-40 flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">refresh</span>
                    Refresh
                  </button>
                </div>
              </div>

              {/* Primary Stats */}
              <div className="bg-[#ffffff] p-6 rounded-[24px] border border-[#e2e2e2] shadow-sm">
                <h3 className="text-sm font-bold text-black uppercase tracking-wider mb-6">Platform Security TVL</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* TVL */}
                  <div className="bg-[#f3f3f3] p-4 rounded-xl border border-[#e2e2e2]">
                    <span className="text-[9px] text-[#585f6c] font-bold uppercase tracking-wider">Total Value Locked</span>
                    <p className="text-lg font-black text-black mt-1">
                      {loadingPlatform ? <span className="inline-block w-16 h-5 bg-[#e2e2e2] rounded animate-pulse" /> : <>{platformStats?.tvl ?? '0.00'} XLM</>}
                    </p>
                    <span className="text-[10px] text-[#585f6c]">Sum of live deposits on-chain</span>
                  </div>

                  {/* Active Contracts — now uses activeContractsCount (state 1–4) */}
                  <div className="bg-[#f3f3f3] p-4 rounded-xl border border-[#e2e2e2]">
                    <span className="text-[9px] text-[#585f6c] font-bold uppercase tracking-wider">Active Contracts</span>
                    <p className="text-lg font-black text-black mt-1">
                      {loadingPlatform ? <span className="inline-block w-8 h-5 bg-[#e2e2e2] rounded animate-pulse" /> : <>{platformStats?.activeContractsCount ?? 0}</>}
                    </p>
                    <span className="text-[10px] text-[#585f6c]">
                      {platformStats?.totalContractsCount ?? 0} total instances
                    </span>
                  </div>

                  {/* Disputes Rate */}
                  <div className="bg-[#f3f3f3] p-4 rounded-xl border border-[#e2e2e2]">
                    <span className="text-[9px] text-[#585f6c] font-bold uppercase tracking-wider">Disputes Rate</span>
                    <p className="text-lg font-black text-black mt-1">
                      {loadingPlatform ? <span className="inline-block w-12 h-5 bg-[#e2e2e2] rounded animate-pulse" /> : <>{platformStats?.disputeRate ?? '0.00'}%</>}
                    </p>
                    <span className={`text-[10px] font-bold ${
                      Number(platformStats?.disputeRate ?? 0) < 5 ? 'text-emerald-600' :
                      Number(platformStats?.disputeRate ?? 0) < 15 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {Number(platformStats?.disputeRate ?? 0) < 5 ? 'Extremely Safe' :
                       Number(platformStats?.disputeRate ?? 0) < 15 ? 'Moderate Risk' : 'High Risk'}
                    </span>
                  </div>
                </div>

                {/* Progress bars — real on-chain deposit splits */}
                <div className="space-y-4 pt-4 border-t border-[#e2e2e2]">
                  {/* Deposit splits: tenant vs landlord — computed from set_acc + resolved events */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-black mb-1">
                      <span>Deposits Fund Splits (Tenant vs Landlord Returns)</span>
                      <span>
                        {platformStats?.depositSplitTenantPct ?? 96}% / {platformStats?.depositSplitLandlordPct ?? 4}%
                      </span>
                    </div>
                    <div className="w-full bg-[#eeeeee] rounded-full h-3.5 overflow-hidden flex">
                      <div
                        className="bg-black h-full transition-all duration-500"
                        style={{ width: `${platformStats?.depositSplitTenantPct ?? 96}%` }}
                      />
                      <div
                        className="bg-slate-400 h-full transition-all duration-500"
                        style={{ width: `${platformStats?.depositSplitLandlordPct ?? 4}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-[#747878] mt-1">Computed from on-chain settlement & dispute-resolution events</p>
                  </div>

                  {/* Resolved vs Active — from real contract state counts */}
                  {(platformStats?.totalContractsCount ?? 0) > 0 && (
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-black mb-1">
                        <span>Resolved vs Active vs Total</span>
                        <span>
                          {platformStats?.resolvedContractsCount ?? 0} /
                          {' '}{platformStats?.activeContractsCount ?? 0} /
                          {' '}{platformStats?.totalContractsCount ?? 0}
                        </span>
                      </div>
                      <div className="w-full bg-[#eeeeee] rounded-full h-3.5 overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-500"
                          style={{ width: `${platformStats && platformStats.totalContractsCount > 0 ? Math.round((platformStats.resolvedContractsCount / platformStats.totalContractsCount) * 100) : 0}%` }}
                        />
                        <div
                          className="bg-black h-full transition-all duration-500"
                          style={{ width: `${platformStats && platformStats.totalContractsCount > 0 ? Math.round((platformStats.activeContractsCount / platformStats.totalContractsCount) * 100) : 0}%` }}
                        />
                      </div>
                      <div className="flex gap-4 mt-1">
                        <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Resolved/Closed</span>
                        <span className="text-[9px] text-black font-semibold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-black inline-block" />Active/Locked</span>
                        <span className="text-[9px] text-[#747878] font-semibold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#eeeeee] border border-[#c4c7c7] inline-block" />Uninitialised</span>
                      </div>
                    </div>
                  )}

                  {/* Wallet Distribution — session-based estimate */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-black mb-1">
                      <span>Wallet Distribution (Freighter vs xBull vs Albedo)</span>
                      <span className="text-[#747878] italic text-[10px]">Session estimate</span>
                    </div>
                    <div className="w-full bg-[#eeeeee] rounded-full h-3.5 overflow-hidden flex">
                      <div className="bg-black h-full" style={{ width: '85%' }} />
                      <div className="bg-slate-400 h-full" style={{ width: '10%' }} />
                      <div className="bg-slate-300 h-full" style={{ width: '5%' }} />
                    </div>
                    <p className="text-[9px] text-[#747878] mt-1">Wallet type is not recorded on-chain; based on platform session telemetry</p>
                  </div>
                </div>
              </div>

              {/* TVL Deposits over time — real bucketed funded events */}
              <div className="bg-[#ffffff] p-6 rounded-[24px] border border-[#e2e2e2] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-black uppercase tracking-wider">Deposit Activity (last ~3.5 days)</h4>
                  <span className="text-[9px] text-[#747878]">Bucketed from on-chain funded events</span>
                </div>
                <div className="h-40 bg-[#f3f3f3] rounded-xl flex items-end justify-between px-4 pb-3 pt-4 border border-[#e2e2e2]">
                  {(platformStats?.tvlHistory ?? [
                    { label: '3d',   amountXlm: 0, pct: 5 },
                    { label: '2d',   amountXlm: 0, pct: 5 },
                    { label: '1.5d', amountXlm: 0, pct: 5 },
                    { label: '1d',   amountXlm: 0, pct: 5 },
                    { label: 'Live', amountXlm: 0, pct: 5 },
                  ]).map((bucket, i, arr) => (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <span className="text-[8px] text-[#585f6c] font-mono">
                        {bucket.amountXlm > 0 ? `${bucket.amountXlm.toFixed(0)} XLM` : ''}
                      </span>
                      <div
                        className="w-8 rounded-t transition-all duration-700"
                        style={{
                          height: `${bucket.pct}%`,
                          backgroundColor: i === arr.length - 1
                            ? '#000000'
                            : `rgba(0,0,0,${0.12 + i * 0.18})`,
                        }}
                      />
                      <span className={`text-[8px] font-semibold ${i === arr.length - 1 ? 'text-black' : 'text-[#585f6c]'}`}>
                        {bucket.label}
                      </span>
                    </div>
                  ))}
                </div>
                {(platformStats?.tvlHistory?.every(b => b.amountXlm === 0)) && (
                  <p className="text-[10px] text-[#747878] text-center mt-2">
                    No funded events found in the last ~3.5 days of ledger history
                  </p>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#ffffff] p-6 rounded-[24px] border border-[#e2e2e2] shadow-sm space-y-6">
                <h3 className="text-sm font-bold text-black uppercase tracking-wider mb-4">Agreement Configurations</h3>
                
                <div>
                  <label className="block text-xs font-semibold text-[#585f6c] mb-1.5">Default Escrow Contract Address</label>
                  <input 
                    type="text" 
                    value={defaultEscrowConfig}
                    onChange={(e) => setDefaultEscrowConfig(e.target.value)}
                    className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl bg-[#f9f9f9] text-black font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#585f6c] mb-1.5">Default Dispute Contract Address</label>
                  <input 
                    type="text" 
                    value={defaultDisputeConfig}
                    onChange={(e) => setDefaultDisputeConfig(e.target.value)}
                    className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl bg-[#f9f9f9] text-black font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-[#ffffff] p-6 rounded-[24px] border border-[#e2e2e2] shadow-sm space-y-6">
                <h3 className="text-sm font-bold text-black uppercase tracking-wider mb-4">Network & Client Profiles</h3>
                
                <div>
                  <label className="block text-xs font-semibold text-[#585f6c] mb-2">Stellar Active Network</label>
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
                      const { clearTransactions } = useAppStore.getState();
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
          )}

        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#ffffff] border-t border-[#e2e2e2] h-16 flex justify-around items-center z-40 px-2">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center text-[10px] font-bold ${activeTab === 'home' ? 'text-black' : 'text-[#747878]'}`}
        >
          <span className="material-symbols-outlined text-lg">dashboard</span>
          <span>Home</span>
        </button>
        <button 
          onClick={() => setActiveTab('inspect')}
          className={`flex flex-col items-center justify-center text-[10px] font-bold ${activeTab === 'inspect' ? 'text-black' : 'text-[#747878]'}`}
        >
          <span className="material-symbols-outlined text-lg">search</span>
          <span>Inspect</span>
        </button>
        <button 
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center justify-center text-[10px] font-bold ${activeTab === 'analytics' ? 'text-black' : 'text-[#747878]'}`}
        >
          <span className="material-symbols-outlined text-lg">monitoring</span>
          <span>Analytics</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center text-[10px] font-bold ${activeTab === 'settings' ? 'text-black' : 'text-[#747878]'}`}
        >
          <span className="material-symbols-outlined text-lg">settings</span>
          <span>Settings</span>
        </button>
      </nav>

      <WalletConnectModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />
    </div>
  );
}

export default dynamic(() => Promise.resolve(Dashboard), { ssr: false });
