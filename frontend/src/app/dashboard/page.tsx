'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStellar } from '../../hooks/useStellar';
import { RentalAgreementData, DisputeData } from '../../services/stellar';
import { useWalletStore } from '../../state/useWalletStore';
import { useTransactionStore } from '../../state/useTransactionStore';
import confetti from 'canvas-confetti';
import { 
  Plus, 
  Lock, 
  ArrowRight, 
  Scale, 
  ShieldAlert, 
  Clock, 
  User, 
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Eye,
  FileText,
  Home,
  MessageSquare
} from 'lucide-react';

export default function Dashboard() {
  const service = useStellar();
  const { address, walletId, connected } = useWalletStore();
  const { addTransaction, updateStatus } = useTransactionStore();

  // Modal display states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  // Form states for creating agreement
  const [tenantAddr, setTenantAddr] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  // Propose deduction states (agreementId -> deduction values)
  const [proposals, setProposals] = useState<Record<number, { landlord: string; tenant: string }>>({});

  // Dispute reason state (agreementId -> reason string)
  const [disputeReasons, setDisputeReasons] = useState<Record<number, string>>({});

  // Arbiter resolution states (disputeId -> resolution amounts)
  const [resolutions, setResolutions] = useState<Record<number, { landlord: string; tenant: string }>>({});

  // Toggle balance mask
  const [hideBalance, setHideBalance] = useState(false);

  // ----------------------------------------------------
  // Queries
  // ----------------------------------------------------

  const { data: agreements = [], isLoading: loadingAgreements, refetch: refetchAgreements } = useQuery({
    queryKey: ['agreements', service.getConfig().escrow, address],
    queryFn: async () => {
      if (!connected) return [];
      const count = await service.getAgreementCount();
      const list: RentalAgreementData[] = [];
      for (let i = 1; i <= count; i++) {
        try {
          const item = await service.getAgreement(i);
          list.push(item);
        } catch (e) {
          // ignore
        }
      }
      return list;
    },
    enabled: connected,
    refetchInterval: 10000,
  });

  const { data: disputes = [], isLoading: loadingDisputes, refetch: refetchDisputes } = useQuery({
    queryKey: ['disputes', service.getConfig().dispute, address],
    queryFn: async () => {
      if (!connected) return [];
      const count = await service.getDisputeCount();
      const list: DisputeData[] = [];
      for (let i = 1; i <= count; i++) {
        try {
          const item = await service.getDispute(i);
          list.push(item);
        } catch (e) {
          // ignore
        }
      }
      return list;
    },
    enabled: connected,
    refetchInterval: 10000,
  });

  // Role Filtering
  const tenantAgreements = agreements.filter(a => a.tenant.toLowerCase() === address?.toLowerCase());
  const landlordAgreements = agreements.filter(a => a.landlord.toLowerCase() === address?.toLowerCase());

  // Aggregate stats
  const activeCount = agreements.filter(a => a.state === 1).length; // Active
  const pendingCount = agreements.filter(a => a.state === 0).length; // PendingDeposit
  const settledCount = agreements.filter(a => a.state === 3).length; // Settled
  
  // Calculate total locked balance in XLM for active agreements
  const totalLockedXlm = agreements
    .filter(a => a.state === 1 || a.state === 2)
    .reduce((sum, a) => sum + a.amount, 0);
  
  // Assume a mock rate of 1 XLM = $0.10 for display conversion
  const totalLockedUsd = totalLockedXlm * 0.10;

  // ----------------------------------------------------
  // Smart Contract Interaction Handlers
  // ----------------------------------------------------

  const handleCreateAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !walletId) return;

    const amount = parseFloat(depositAmount);
    if (!tenantAddr || isNaN(amount) || amount <= 0) {
      alert("Please provide a valid tenant address and deposit amount.");
      return;
    }

    const txId = addTransaction("Create Escrow Agreement");
    setShowCreateModal(false);

    try {
      updateStatus(txId, "processing");
      const hash = await service.createAgreement(tenantAddr, address, amount, address, walletId);
      updateStatus(txId, "confirmed", hash);
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      setTenantAddr('');
      setDepositAmount('');
      refetchAgreements();
    } catch (err: any) {
      updateStatus(txId, "failed", undefined, err.message || "Error submitting transaction");
    }
  };

  const handleDeposit = async (agreementId: number, amount: number) => {
    if (!address || !walletId) return;

    const txId = addTransaction(`Lock Deposit (ID: ${agreementId})`, () => handleDeposit(agreementId, amount));
    setShowLockModal(false);

    try {
      updateStatus(txId, "processing");
      const hash = await service.depositEscrow(agreementId, address, walletId);
      updateStatus(txId, "confirmed", hash);
      confetti({ particleCount: 100, spread: 80 });
      refetchAgreements();
    } catch (err: any) {
      updateStatus(txId, "failed", undefined, err.message || "Error submitting deposit");
    }
  };

  const handleProposeDeduction = async (agreementId: number) => {
    if (!address || !walletId) return;

    const prop = proposals[agreementId];
    if (!prop) return;

    const landlordClaim = parseFloat(prop.landlord);
    if (isNaN(landlordClaim) || landlordClaim < 0) {
      alert("Invalid landlord claim amount");
      return;
    }

    const agreement = agreements.find(a => a.id === agreementId);
    if (!agreement) return;

    const tenantSplit = Math.max(0, agreement.amount - landlordClaim);

    const txId = addTransaction(`Propose Refund Split (ID: ${agreementId})`, () => handleProposeDeduction(agreementId));
    setShowProposeModal(false);

    try {
      updateStatus(txId, "processing");
      const hash = await service.proposeDeduction(agreementId, landlordClaim, tenantSplit, address, walletId);
      updateStatus(txId, "confirmed", hash);
      refetchAgreements();
    } catch (err: any) {
      updateStatus(txId, "failed", undefined, err.message || "Error proposing split");
    }
  };

  const handleApproveDeduction = async (agreementId: number) => {
    if (!address || !walletId) return;

    const txId = addTransaction(`Approve Refund (ID: ${agreementId})`, () => handleApproveDeduction(agreementId));
    try {
      updateStatus(txId, "processing");
      const hash = await service.approveDeduction(agreementId, address, walletId);
      updateStatus(txId, "confirmed", hash);
      confetti({ particleCount: 120, colors: ['#22c55e', '#ffffff'] });
      refetchAgreements();
    } catch (err: any) {
      updateStatus(txId, "failed", undefined, err.message || "Error approving refund");
    }
  };

  const handleRaiseDispute = async (agreementId: number) => {
    if (!address || !walletId) return;

    const reason = disputeReasons[agreementId] || "Generic dispute request";
    const txId = addTransaction(`File Escrow Dispute (ID: ${agreementId})`, () => handleRaiseDispute(agreementId));
    setShowDisputeModal(false);

    try {
      updateStatus(txId, "processing");
      const hash = await service.raiseDispute(agreementId, address, reason, address, walletId);
      updateStatus(txId, "confirmed", hash);
      refetchAgreements();
      refetchDisputes();
    } catch (err: any) {
      updateStatus(txId, "failed", undefined, err.message || "Error filing dispute");
    }
  };

  const handleResolveDispute = async (disputeId: number) => {
    if (!address || !walletId) return;

    const res = resolutions[disputeId];
    if (!res) return;

    const landlordSplit = parseFloat(res.landlord);
    const tenantSplit = parseFloat(res.tenant);

    if (isNaN(landlordSplit) || isNaN(tenantSplit) || landlordSplit < 0 || tenantSplit < 0) {
      alert("Invalid split values");
      return;
    }

    const txId = addTransaction(`Resolve Dispute (ID: ${disputeId})`, () => handleResolveDispute(disputeId));
    setShowDisputeModal(false);

    try {
      updateStatus(txId, "processing");
      const hash = await service.resolveDispute(disputeId, landlordSplit, tenantSplit, address, walletId);
      updateStatus(txId, "confirmed", hash);
      refetchAgreements();
      refetchDisputes();
    } catch (err: any) {
      updateStatus(txId, "failed", undefined, err.message || "Error resolving dispute");
    }
  };

  // Convert status ID to readable text
  const getStatusString = (status: number) => {
    switch (status) {
      case 0: return 'Pending Deposit';
      case 1: return 'Active Lease';
      case 2: return 'Refund Proposed';
      case 3: return 'Settled';
      case 4: return 'Disputed';
      default: return 'Unknown';
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Stat Grid Section (FINAI style top row) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Total Locked Deposits Dark Card (Mocks FINAI Total Balance card) */}
        <div className="lg:col-span-1 bg-[#0f1717] text-white p-6 rounded-2xl flex flex-col justify-between h-48 border border-slate-900">
          <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Locked Deposits</span>
            <button 
              onClick={() => setHideBalance(!hideBalance)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
          
          <div className="my-2">
            <span className="text-3xl font-extrabold tracking-tight block">
              {hideBalance ? (
                <>$ ••••••••</>
              ) : (
                <>${totalLockedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
              )}
            </span>
            <span className="text-xs text-slate-400 font-medium block mt-1">
              ≈ {totalLockedXlm.toLocaleString()} XLM
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-green-400 font-bold bg-white/5 border border-white/10 w-fit px-2.5 py-0.5 rounded-full">
            <span>↑ 5.2%</span>
            <span className="text-slate-400 font-medium">vs last month</span>
          </div>
        </div>

        {/* Three Stat Cards block (Mocks Monthly Income, Monthly Expenses, Monthly Savings) */}
        <div className="lg:col-span-2 grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200/60 p-5 rounded-2xl flex flex-col justify-between h-48">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Active Leases</span>
              <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-1.5 py-0.5 rounded-lg">
                🟢 {activeCount}
              </span>
            </div>
            <div className="my-2">
              <span className="text-2xl font-bold text-slate-900 block">{activeCount}</span>
            </div>
            <div className="text-[10px] text-green-600 font-bold bg-green-50/50 border border-green-100 w-fit px-2 py-0.5 rounded-lg">
              ↑ 7.1% <span className="text-slate-400 font-medium">vs last month</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/60 p-5 rounded-2xl flex flex-col justify-between h-48">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Pending Deposits</span>
              <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded-lg">
                🟡 {pendingCount}
              </span>
            </div>
            <div className="my-2">
              <span className="text-2xl font-bold text-slate-900 block">{pendingCount}</span>
            </div>
            <div className="text-[10px] text-red-500 font-bold bg-red-50/50 border border-red-100 w-fit px-2 py-0.5 rounded-lg">
              ↓ 3.6% <span className="text-slate-400 font-medium font-sans">vs last month</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/60 p-5 rounded-2xl flex flex-col justify-between h-48">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Resolved Claims</span>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded-lg">
                ✓ {settledCount}
              </span>
            </div>
            <div className="my-2">
              <span className="text-2xl font-bold text-slate-900 block">{settledCount}</span>
            </div>
            <div className="text-[10px] text-green-600 font-bold bg-green-50/50 border border-green-100 w-fit px-2 py-0.5 rounded-lg">
              ↑ 8.3% <span className="text-slate-400 font-medium">vs last month</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Donut Chart & Activity Rows (FINAI style middle row) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lease status Donut Chart (Mocks FINAI Spending Overview card) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/60 p-6 rounded-2xl flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Escrow Status Distribution</h3>
              <span className="text-[10px] font-semibold text-slate-400">Live Contracts</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center py-4">
            {/* SVG Donut Chart representation */}
            <div className="flex items-center justify-center relative h-36">
              <svg width="150" height="150" viewBox="0 0 150 150">
                <circle cx="75" cy="75" r="50" fill="transparent" stroke="#f1f5f9" strokeWidth="18" />
                {/* Active split segment - Green */}
                <circle cx="75" cy="75" r="50" fill="transparent" stroke="#1b8b3a" strokeWidth="18" 
                  strokeDasharray="314.15" strokeDashoffset="120" strokeLinecap="round" transform="rotate(-90 75 75)" />
                {/* Pending split segment - Light Green */}
                <circle cx="75" cy="75" r="50" fill="transparent" stroke="#a7f3d0" strokeWidth="18" 
                  strokeDasharray="314.15" strokeDashoffset="240" strokeLinecap="round" transform="rotate(40 75 75)" />
                {/* Dispute split segment - Dark Charcoal */}
                <circle cx="75" cy="75" r="50" fill="transparent" stroke="#0f1717" strokeWidth="18" 
                  strokeDasharray="314.15" strokeDashoffset="280" strokeLinecap="round" transform="rotate(130 75 75)" />
              </svg>
              <div className="absolute text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Top State</span>
                <span className="text-sm font-extrabold text-slate-800 block">Active Lease</span>
              </div>
            </div>

            {/* Labels list */}
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#1b8b3a]" />
                  <span className="text-slate-500">Active</span>
                </div>
                <span className="text-slate-800 text-xs block pl-4">50%</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#a7f3d0]" />
                  <span className="text-slate-500">Pending</span>
                </div>
                <span className="text-slate-800 text-xs block pl-4">20%</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#0f1717]" />
                  <span className="text-slate-500">Disputed</span>
                </div>
                <span className="text-slate-800 text-xs block pl-4">14%</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  <span className="text-slate-500">Settled</span>
                </div>
                <span className="text-slate-800 text-xs block pl-4">16%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column Right Block (Mocks FINAI Smart Insight and Quick Actions) */}
        <div className="lg:col-span-1 flex flex-col justify-between gap-6">
          {/* AI Smart Insight Card */}
          <div className="bg-[#0f1717] text-white p-5 rounded-2xl flex flex-col justify-between flex-1 border border-slate-900">
            <div className="flex items-center gap-1.5 text-[#1b8b3a] font-bold text-xs">
              <span>💡 AI Smart Insight</span>
            </div>
            
            <p className="text-slate-300 text-xs leading-relaxed my-3 font-medium">
              You have {pendingCount} active agreements awaiting your deposit signature. Want suggestions to speed up verification?
            </p>

            <button 
              onClick={() => setShowLockModal(true)}
              className="w-full bg-[#1b8b3a] hover:bg-[#156c2d] text-white text-xs font-semibold py-2 px-4 rounded-xl transition-colors text-center"
            >
              View Suggestions
            </button>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white border border-slate-200/60 p-5 rounded-2xl flex flex-col justify-between">
            <h3 className="font-bold text-slate-800 text-xs mb-4 uppercase tracking-wider text-slate-400">Quick Actions</h3>
            <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-slate-600">
              <button 
                onClick={() => setShowCreateModal(true)}
                className="flex flex-col items-center gap-2"
              >
                <div className="h-11 w-11 rounded-xl bg-[#f4f6f6] border border-slate-200/60 flex items-center justify-center text-[#1b8b3a]">
                  <Plus className="h-4 w-4" />
                </div>
                <span>Create</span>
              </button>
              
              <button 
                onClick={() => setShowLockModal(true)}
                className="flex flex-col items-center gap-2"
              >
                <div className="h-11 w-11 rounded-xl bg-[#f4f6f6] border border-slate-200/60 flex items-center justify-center text-[#1b8b3a]">
                  <Lock className="h-4 w-4" />
                </div>
                <span>Lock</span>
              </button>

              <button 
                onClick={() => setShowProposeModal(true)}
                className="flex flex-col items-center gap-2"
              >
                <div className="h-11 w-11 rounded-xl bg-[#f4f6f6] border border-slate-200/60 flex items-center justify-center text-[#1b8b3a]">
                  <ArrowRight className="h-4 w-4" />
                </div>
                <span>Refund</span>
              </button>

              <button 
                onClick={() => setShowDisputeModal(true)}
                className="flex flex-col items-center gap-2"
              >
                <div className="h-11 w-11 rounded-xl bg-[#f4f6f6] border border-slate-200/60 flex items-center justify-center text-[#1b8b3a]">
                  <Scale className="h-4 w-4" />
                </div>
                <span>Dispute</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Recommendations & Recent Tables (FINAI style bottom row) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recommendation Cards list */}
        <div className="lg:col-span-1 bg-white border border-slate-200/60 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-slate-400">AI Recommendations</h3>
            <span className="text-[10px] text-[#1b8b3a] font-bold cursor-pointer hover:underline">View All</span>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-[#f4f6f6] border border-slate-200/50 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg text-[#1b8b3a]">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Lock pending deposits</span>
                <span className="text-[10px] text-slate-400 block font-medium">Agreement #4 requires confirmation</span>
              </div>
            </div>

            <div className="p-3 bg-[#f4f6f6] border border-slate-200/50 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg text-[#1b8b3a]">
                <User className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Update your profiles</span>
                <span className="text-[10px] text-slate-400 block font-medium">Setup custom configurations</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Agreements list (Mocks Recent Transactions) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/60 p-6 rounded-2xl flex flex-col justify-between min-h-[250px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Recent Escrow Agreements</h3>
            <span className="text-[10px] text-[#1b8b3a] font-bold cursor-pointer hover:underline">View All</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="py-2.5">Title</th>
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Role</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agreements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                      No agreements found. Connect your wallet to view or create agreements.
                    </td>
                  </tr>
                ) : (
                  agreements.slice(-3).map((agreement) => {
                    const isUserLandlord = agreement.landlord.toLowerCase() === address?.toLowerCase();
                    return (
                      <tr key={agreement.id} className="text-slate-700">
                        <td className="py-3 flex items-center gap-2.5">
                          <div className="p-1.5 bg-[#f4f6f6] border border-slate-200/60 rounded-lg text-[#1b8b3a]">
                            <Home className="h-3.5 w-3.5" />
                          </div>
                          <span>Agreement #{agreement.id}</span>
                        </td>
                        <td className="py-3 text-slate-400">Today</td>
                        <td className="py-3 capitalize">{isUserLandlord ? 'Landlord' : 'Tenant'}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            agreement.state === 1 
                              ? 'bg-green-50 text-green-700 border border-green-100'
                              : agreement.state === 3 
                              ? 'bg-red-50 text-red-700 border border-red-100'
                              : 'bg-slate-50 text-slate-600 border border-slate-100'
                          }`}>
                            {getStatusString(agreement.state)}
                          </span>
                        </td>
                        <td className="py-3 text-right font-extrabold text-slate-900">
                          {isUserLandlord ? '+' : '-'}{agreement.amount} XLM
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------
          Interactive Action Modals (Clean, Flat White Style)
         ---------------------------------------------------- */}

      {/* A. Create Escrow Agreement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-[#0f1717]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form 
            onSubmit={handleCreateAgreement}
            className="bg-white border border-slate-200/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 text-slate-800"
          >
            <h2 className="text-lg font-bold text-slate-900">Create Escrow Agreement</h2>
            <p className="text-xs text-slate-400">Initiate a security deposit lock by specifying your tenant's address and the lockup amount.</p>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tenant Address (Public Key)</label>
                <input 
                  type="text" 
                  value={tenantAddr}
                  onChange={(e) => setTenantAddr(e.target.value)}
                  placeholder="G..." 
                  className="w-full bg-[#f4f6f6] border border-slate-200 py-2.5 px-3 rounded-xl text-xs focus:outline-none focus:border-[#1b8b3a] font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Deduction / Deposit Amount (XLM)</label>
                <input 
                  type="number" 
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="1000" 
                  className="w-full bg-[#f4f6f6] border border-slate-200 py-2.5 px-3 rounded-xl text-xs focus:outline-none focus:border-[#1b8b3a]"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-[#f4f6f6] border border-slate-200 text-slate-600 py-2.5 px-4 rounded-xl text-xs font-semibold text-center"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 bg-[#1b8b3a] hover:bg-[#156c2d] text-white py-2.5 px-4 rounded-xl text-xs font-semibold text-center"
              >
                Create Escrow
              </button>
            </div>
          </form>
        </div>
      )}

      {/* B. Lock Deposit (Pay Escrow) Modal */}
      {showLockModal && (
        <div className="fixed inset-0 bg-[#0f1717]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 text-slate-800">
            <h2 className="text-lg font-bold text-slate-900">Lock Pending Deposits</h2>
            <p className="text-xs text-slate-400">Review agreements waiting for your escrow deposit authorization.</p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {tenantAgreements.filter(a => a.state === 0).length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-medium">
                  No pending agreements awaiting your signature.
                </div>
              ) : (
                tenantAgreements.filter(a => a.state === 0).map((agreement) => (
                  <div key={agreement.id} className="p-3 bg-[#f4f6f6] border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold block">Agreement #{agreement.id}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Landlord: {agreement.landlord.substring(0, 6)}...</span>
                    </div>
                    <button 
                      onClick={() => handleDeposit(agreement.id, agreement.amount)}
                      className="bg-[#1b8b3a] hover:bg-[#156c2d] text-white text-[10px] font-bold py-1.5 px-3 rounded-lg"
                    >
                      Deposit {agreement.amount} XLM
                    </button>
                  </div>
                ))
              )}
            </div>

            <button 
              onClick={() => setShowLockModal(false)}
              className="w-full bg-[#f4f6f6] border border-slate-200 text-slate-600 py-2.5 px-4 rounded-xl text-xs font-semibold text-center"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* C. Propose Refund / Deduction Modal */}
      {showProposeModal && (
        <div className="fixed inset-0 bg-[#0f1717]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 text-slate-800">
            <h2 className="text-lg font-bold text-slate-900">Propose Refund Split</h2>
            <p className="text-xs text-slate-400">Submit a refund deduction proposal to return locked funds back to the tenant.</p>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {landlordAgreements.filter(a => a.state === 1).length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-medium">
                  No active agreements available to propose a refund.
                </div>
              ) : (
                landlordAgreements.filter(a => a.state === 1).map((agreement) => {
                  const prop = proposals[agreement.id] || { landlord: '0', tenant: agreement.amount.toString() };
                  return (
                    <div key={agreement.id} className="p-4 bg-[#f4f6f6] border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold">Agreement #{agreement.id} ({agreement.amount} XLM)</span>
                        <span className="text-[10px] text-slate-400 font-mono">Tenant: {agreement.tenant.substring(0, 6)}...</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-[10px]">
                        <div>
                          <label className="text-slate-400 font-bold block mb-1">Landlord Claim (Deduction)</label>
                          <input 
                            type="number"
                            value={prop.landlord}
                            onChange={(e) => {
                              const value = e.target.value;
                              const amt = agreement.amount;
                              const claim = parseFloat(value) || 0;
                              setProposals({
                                ...proposals,
                                [agreement.id]: { landlord: value, tenant: Math.max(0, amt - claim).toString() }
                              });
                            }}
                            className="w-full bg-white border border-slate-200 p-2 rounded-lg text-slate-700"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 font-bold block mb-1">Tenant Refund (Remainder)</label>
                          <input 
                            type="text"
                            value={prop.tenant}
                            disabled
                            className="w-full bg-slate-100 border border-slate-200 p-2 rounded-lg text-slate-400 cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={() => handleProposeDeduction(agreement.id)}
                        className="w-full bg-[#1b8b3a] hover:bg-[#156c2d] text-white text-xs font-semibold py-2 px-3 rounded-xl"
                      >
                        Submit Split Proposal
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <button 
              onClick={() => setShowProposeModal(false)}
              className="w-full bg-[#f4f6f6] border border-slate-200 text-slate-600 py-2.5 px-4 rounded-xl text-xs font-semibold text-center"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* D. Dispute List & Arbiter Resolution Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-[#0f1717]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 text-slate-800">
            <h2 className="text-lg font-bold text-slate-900">Dispute Resolution Console</h2>
            <p className="text-xs text-slate-400">File a dispute as a tenant, or review registry filings to resolve active claims as an arbiter.</p>

            <div className="space-y-4 max-h-80 overflow-y-auto">
              {/* Tenant view to raise disputes */}
              <div>
                <span className="text-[10px] uppercase font-bold text-[#1b8b3a] tracking-widest block mb-2">Raise Escrow Dispute</span>
                {tenantAgreements.filter(a => a.state === 2).length === 0 ? (
                  <div className="text-center py-3 bg-[#f4f6f6] border border-slate-200/50 rounded-xl text-[10px] text-slate-400">
                    No pending landlord proposals available to dispute.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tenantAgreements.filter(a => a.state === 2).map((agreement) => (
                      <div key={agreement.id} className="p-3 bg-[#f4f6f6] border border-slate-200 rounded-xl space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold">Agreement #{agreement.id}</span>
                          <span className="text-slate-400">Proposed Claim: {agreement.refundLandlordAmount} XLM</span>
                        </div>
                        
                        <div className="relative">
                          <input 
                            type="text" 
                            placeholder="Reason for dispute..."
                            value={disputeReasons[agreement.id] || ''}
                            onChange={(e) => setDisputeReasons({ ...disputeReasons, [agreement.id]: e.target.value })}
                            className="w-full bg-white border border-slate-200 py-1.5 px-3 rounded-lg text-xs"
                          />
                        </div>

                        <button 
                          onClick={() => handleRaiseDispute(agreement.id)}
                          className="w-full bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg"
                        >
                          Reject proposal & file dispute
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Arbiter Console */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-2">Arbiter Active Claims</span>
                {disputes.filter(d => d.state === 0).length === 0 ? (
                  <div className="text-center py-4 bg-[#f4f6f6] border border-slate-200/50 rounded-xl text-[10px] text-slate-400">
                    No active disputes registered in the contract.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {disputes.filter(d => d.state === 0).map((dispute) => {
                      const res = resolutions[dispute.id] || { landlord: '0', tenant: '0' };
                      return (
                        <div key={dispute.id} className="p-3 bg-red-50/50 border border-red-200 rounded-xl space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold">Dispute #{dispute.id} (Escrow #{dispute.agreementId})</span>
                            <span className="text-slate-400">Total: {dispute.amount} XLM</span>
                          </div>
                          
                          <p className="text-[10px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
                            Reason: "{dispute.reason}"
                          </p>

                          <div className="grid grid-cols-2 gap-3 text-[10px]">
                            <div>
                              <label className="text-slate-400 block mb-1">Landlord Award (XLM)</label>
                              <input 
                                type="number" 
                                value={res.landlord}
                                onChange={(e) => setResolutions({
                                  ...resolutions,
                                  [dispute.id]: { ...res, landlord: e.target.value }
                                })}
                                className="w-full bg-white border border-slate-200 p-2 rounded-lg text-slate-700"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 block mb-1">Tenant Award (XLM)</label>
                              <input 
                                type="number" 
                                value={res.tenant}
                                onChange={(e) => setResolutions({
                                  ...resolutions,
                                  [dispute.id]: { ...res, tenant: e.target.value }
                                })}
                                className="w-full bg-white border border-slate-200 p-2 rounded-lg text-slate-700"
                              />
                            </div>
                          </div>

                          <button 
                            onClick={() => handleResolveDispute(dispute.id)}
                            className="w-full bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg"
                          >
                            Execute Arbiter Resolution
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={() => setShowDisputeModal(false)}
              className="w-full bg-[#f4f6f6] border border-slate-200 text-slate-600 py-2.5 px-4 rounded-xl text-xs font-semibold text-center"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
