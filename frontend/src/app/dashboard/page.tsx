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
  ArrowDownCircle, 
  ArrowUpRight, 
  Scale, 
  ShieldAlert, 
  FileCheck, 
  Clock, 
  User, 
  DollarSign, 
  CheckCircle,
  HelpCircle,
  AlertCircle
} from 'lucide-react';

export default function Dashboard() {
  const service = useStellar();
  const { address, walletId, connected } = useWalletStore();
  const { addTransaction, updateStatus } = useTransactionStore();

  const [activeTab, setActiveTab] = useState<'tenant' | 'landlord' | 'arbiter'>('tenant');

  // Form states for creating agreement
  const [tenantAddr, setTenantAddr] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  // Propose deduction states (agreementId -> deduction values)
  const [proposals, setProposals] = useState<Record<number, { landlord: string; tenant: string }>>({});

  // Dispute reason state (agreementId -> reason string)
  const [disputeReasons, setDisputeReasons] = useState<Record<number, string>>({});

  // Arbiter resolution states (disputeId -> resolution amounts)
  const [resolutions, setResolutions] = useState<Record<number, { landlord: string; tenant: string }>>({});

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
          // ignore or log
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

  // Filter lists based on role
  const tenantAgreements = agreements.filter(a => a.tenant.toLowerCase() === address?.toLowerCase());
  const landlordAgreements = agreements.filter(a => a.landlord.toLowerCase() === address?.toLowerCase());

  // ----------------------------------------------------
  // Actions
  // ----------------------------------------------------

  const handleCreateAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !walletId) return;

    const amountNum = parseFloat(depositAmount);
    if (!tenantAddr || isNaN(amountNum) || amountNum <= 0) return;

    const retryAction = () => service.createAgreement(tenantAddr, address, amountNum, address, walletId);
    const txId = addTransaction('Create Escrow Agreement', retryAction);

    try {
      updateStatus(txId, 'processing');
      const hash = await retryAction();
      updateStatus(txId, 'confirmed', hash);
      setTenantAddr('');
      setDepositAmount('');
      refetchAgreements();
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
    } catch (err: any) {
      updateStatus(txId, 'failed', null, err.message || 'Agreement creation failed');
    }
  };

  const handleDeposit = async (agreementId: number) => {
    if (!address || !walletId) return;

    const retryAction = () => service.depositEscrow(agreementId, address, walletId);
    const txId = addTransaction('Deposit Security Funds', retryAction);

    try {
      updateStatus(txId, 'processing');
      const hash = await retryAction();
      updateStatus(txId, 'confirmed', hash);
      refetchAgreements();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
    } catch (err: any) {
      updateStatus(txId, 'failed', null, err.message || 'Deposit lock failed');
    }
  };

  const handleProposeDeduction = async (agreementId: number, totalAmount: number) => {
    if (!address || !walletId) return;
    const prop = proposals[agreementId];
    if (!prop) return;

    const landlordAmt = parseFloat(prop.landlord);
    const tenantAmt = parseFloat(prop.tenant);
    if (isNaN(landlordAmt) || isNaN(tenantAmt) || landlordAmt + tenantAmt !== totalAmount) {
      alert(`Invalid inputs. Sum of claims must equal the total deposit amount (${totalAmount} XLM)`);
      return;
    }

    const retryAction = () => service.proposeDeduction(agreementId, landlordAmt, tenantAmt, address, walletId);
    const txId = addTransaction('Propose Deduction', retryAction);

    try {
      updateStatus(txId, 'processing');
      const hash = await retryAction();
      updateStatus(txId, 'confirmed', hash);
      refetchAgreements();
    } catch (err: any) {
      updateStatus(txId, 'failed', null, err.message || 'Propose deduction failed');
    }
  };

  const handleApproveDeduction = async (agreementId: number) => {
    if (!address || !walletId) return;

    const retryAction = () => service.approveDeduction(agreementId, address, walletId);
    const txId = addTransaction('Approve Deposit Claim', retryAction);

    try {
      updateStatus(txId, 'processing');
      const hash = await retryAction();
      updateStatus(txId, 'confirmed', hash);
      refetchAgreements();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.8 } });
    } catch (err: any) {
      updateStatus(txId, 'failed', null, err.message || 'Approval execution failed');
    }
  };

  const handleRaiseDispute = async (agreementId: number) => {
    if (!address || !walletId) return;
    const reason = disputeReasons[agreementId] || 'Unresolved refund dispute';

    const retryAction = () => service.raiseDispute(agreementId, address, reason, address, walletId);
    const txId = addTransaction('Escrow Claim Dispute', retryAction);

    try {
      updateStatus(txId, 'processing');
      const hash = await retryAction();
      updateStatus(txId, 'confirmed', hash);
      refetchAgreements();
      refetchDisputes();
    } catch (err: any) {
      updateStatus(txId, 'failed', null, err.message || 'Dispute raising failed');
    }
  };

  const handleResolveDispute = async (disputeId: number, totalAmount: number) => {
    if (!address || !walletId) return;
    const res = resolutions[disputeId];
    if (!res) return;

    const landlordAmt = parseFloat(res.landlord);
    const tenantAmt = parseFloat(res.tenant);
    if (isNaN(landlordAmt) || isNaN(tenantAmt) || landlordAmt + tenantAmt !== totalAmount) {
      alert(`Invalid split. Sum must equal total dispute amount (${totalAmount} XLM)`);
      return;
    }

    const retryAction = () => service.resolveDispute(disputeId, landlordAmt, tenantAmt, address, walletId);
    const txId = addTransaction('Arbiter Claim Resolution', retryAction);

    try {
      updateStatus(txId, 'processing');
      const hash = await retryAction();
      updateStatus(txId, 'confirmed', hash);
      refetchAgreements();
      refetchDisputes();
      confetti({ particleCount: 80, spread: 60, colors: ['#6366f1', '#10b981'] });
    } catch (err: any) {
      updateStatus(txId, 'failed', null, err.message || 'Dispute resolution failed');
    }
  };

  // State helper components
  const getStateBadge = (state: number) => {
    switch (state) {
      case 0:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="h-3 w-3" /> Awaiting Deposit</span>;
      case 1:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20"><CheckCircle className="h-3 w-3" /> Active Escrow</span>;
      case 2:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><HelpCircle className="h-3 w-3" /> Claim Proposed</span>;
      case 3:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"><ShieldAlert className="h-3 w-3" /> Disputed</span>;
      case 4:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20"><FileCheck className="h-3 w-3" /> Settled</span>;
      default:
        return null;
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ArrowDownCircle className="h-16 w-16 text-slate-700 animate-bounce" />
        <h2 className="text-xl font-bold text-white">Wallet Connection Required</h2>
        <p className="text-slate-400 max-w-sm text-sm">Please connect your Freighter, xBull, or Hana wallet from the sidebar options to view and manage active rental agreements.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Tab Switcher */}
      <div className="flex bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 max-w-md">
        <button
          onClick={() => setActiveTab('tenant')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all ${
            activeTab === 'tenant' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Tenant Console
        </button>
        <button
          onClick={() => setActiveTab('landlord')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all ${
            activeTab === 'landlord' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Landlord Console
        </button>
        <button
          onClick={() => setActiveTab('arbiter')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all ${
            activeTab === 'arbiter' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Arbiter Console
        </button>
      </div>

      {/* Tenant Dashboard View */}
      {activeTab === 'tenant' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-white tracking-tight">Active Tenant Escrows</h2>
            <p className="text-slate-400 text-xs font-medium">Claims and deposits locked under your public address key.</p>
          </div>

          {loadingAgreements ? (
            <div className="py-12 text-center text-slate-500 font-medium">Loading claims from Soroban...</div>
          ) : tenantAgreements.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-850 p-8 rounded-2xl text-center text-slate-500">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-35" />
              <p className="text-sm font-semibold">No agreements found where you are the tenant.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {tenantAgreements.map((a) => (
                <div key={a.id} className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors duration-300">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">Agreement #{a.id}</span>
                      {getStateBadge(a.state)}
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800/60">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500">Deposit locked</span>
                        <span className="text-lg font-extrabold text-white mt-1 block">{a.amount} XLM</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500">Landlord Key</span>
                        <span className="text-sm font-semibold text-slate-300 mt-1.5 block font-mono">{a.landlord.substring(0, 4)}...{a.landlord.substring(a.landlord.length - 4)}</span>
                      </div>
                    </div>

                    {/* Claims Negotiation View */}
                    {a.state === 2 && (
                      <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-xl space-y-3">
                        <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                          <CheckCircle className="h-4 w-4" />
                          Landlord Refund Proposal
                        </span>
                        <p className="text-xs text-slate-400 leading-relaxed">The landlord proposed a split. Approve to release funds automatically, or dispute to trigger neutral arbitration.</p>
                        <div className="flex gap-4 border-t border-slate-800/80 pt-3">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Landlord Claim</span>
                            <span className="text-sm font-bold text-rose-400">{a.refundLandlordAmount} XLM</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Tenant Refund</span>
                            <span className="text-sm font-bold text-green-400">{a.refundTenantAmount} XLM</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions bar */}
                  <div className="mt-6 flex flex-col gap-2">
                    {a.state === 0 && (
                      <button
                        onClick={() => handleDeposit(a.id)}
                        className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2"
                      >
                        <ArrowDownCircle className="h-4 w-4 text-slate-950" />
                        Lock Deposit ({a.amount} XLM)
                      </button>
                    )}

                    {a.state === 2 && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveDeduction(a.id)}
                          className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs"
                        >
                          Accept & Settle
                        </button>
                        <button
                          onClick={() => {
                            const input = prompt("Specify the reason for rejecting deduction:");
                            if (input) {
                              setDisputeReasons({ ...disputeReasons, [a.id]: input });
                              handleRaiseDispute(a.id);
                            }
                          }}
                          className="flex-1 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/20 text-rose-300 font-bold py-2.5 px-4 rounded-xl text-xs"
                        >
                          Reject & Dispute
                        </button>
                      </div>
                    )}

                    {a.state === 1 && (
                      <button
                        onClick={() => {
                          const input = prompt("Specify the reason for the dispute claim:");
                          if (input) {
                            setDisputeReasons({ ...disputeReasons, [a.id]: input });
                            handleRaiseDispute(a.id);
                          }
                        }}
                        className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-750 text-rose-300 font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Raise Dispute Claims
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Landlord Dashboard View */}
      {activeTab === 'landlord' && (
        <div className="space-y-8">
          {/* Create agreement form */}
          <div className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl space-y-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Plus className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-white text-lg">Create Escrow Agreement</h3>
            </div>

            <form onSubmit={handleCreateAgreement} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Tenant Public Key Address (G...)</label>
                <input
                  type="text"
                  placeholder="G..."
                  value={tenantAddr}
                  onChange={(e) => setTenantAddr(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-200 font-mono outline-none"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Escrow Security Amount (XLM)</label>
                <input
                  type="number"
                  placeholder="500"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-stellar border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-200 outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                Create Agreement
              </button>
            </form>
          </div>

          {/* Agreements List */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white tracking-tight">Active Landlord Agreements</h2>

            {loadingAgreements ? (
              <div className="py-12 text-center text-slate-500 font-medium">Loading claims...</div>
            ) : landlordAgreements.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-850 p-8 rounded-2xl text-center text-slate-500">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-35" />
                <p className="text-sm font-semibold">No active escrows registered under your landlord address.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {landlordAgreements.map((a) => (
                  <div key={a.id} className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors duration-300">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">Agreement #{a.id}</span>
                        {getStateBadge(a.state)}
                      </div>

                      <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800/60">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500">Deposit locked</span>
                          <span className="text-lg font-extrabold text-white mt-1 block">{a.amount} XLM</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500">Tenant Key</span>
                          <span className="text-sm font-semibold text-slate-300 mt-1.5 block font-mono">{a.tenant.substring(0, 4)}...{a.tenant.substring(a.tenant.length - 4)}</span>
                        </div>
                      </div>

                      {/* Propose Refund Form */}
                      {(a.state === 1 || a.state === 2) && (
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-850/80 space-y-4">
                          <span className="text-xs font-bold text-slate-300 uppercase block">Propose Refund Split</span>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-semibold text-slate-500">Landlord Claim</label>
                              <input
                                type="number"
                                placeholder="100"
                                value={proposals[a.id]?.landlord || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const calculatedTenant = Math.max(0, a.amount - parseFloat(val || '0'));
                                  setProposals({
                                    ...proposals,
                                    [a.id]: { landlord: val, tenant: isNaN(calculatedTenant) ? '' : calculatedTenant.toString() }
                                  });
                                }}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-semibold text-slate-500">Tenant Refund</label>
                              <input
                                type="number"
                                placeholder="400"
                                value={proposals[a.id]?.tenant || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const calculatedLandlord = Math.max(0, a.amount - parseFloat(val || '0'));
                                  setProposals({
                                    ...proposals,
                                    [a.id]: { landlord: isNaN(calculatedLandlord) ? '' : calculatedLandlord.toString(), tenant: val }
                                  });
                                }}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => handleProposeDeduction(a.id, a.amount)}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3 rounded-lg text-xs"
                          >
                            Submit Refund Proposal
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex flex-col gap-2">
                      {a.state === 0 && (
                        <span className="w-full text-center text-xs text-slate-500 border border-slate-850 p-3 rounded-xl font-medium">Awaiting tenant payment...</span>
                      )}

                      {a.state === 2 && (
                        <div className="bg-indigo-500/5 border border-indigo-500/10 p-3.5 rounded-xl text-center">
                          <span className="text-xs block text-slate-400 font-medium">Proposal submitted. Waiting for tenant approval...</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Arbiter / Admin View */}
      {activeTab === 'arbiter' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-white tracking-tight">Neutral Arbitration Console</h2>
            <p className="text-slate-400 text-xs font-medium">Review and resolve claims escalated to the Dispute Contract registry.</p>
          </div>

          {loadingDisputes ? (
            <div className="py-12 text-center text-slate-500 font-medium">Loading claims...</div>
          ) : disputes.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-850 p-8 rounded-2xl text-center text-slate-500">
              <Scale className="h-10 w-10 mx-auto mb-3 opacity-35 text-indigo-400" />
              <p className="text-sm font-semibold">No active disputes registered in the arbitrator contract.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {disputes.map((d) => (
                <div key={d.id} className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl flex flex-col justify-between hover:border-slate-800 transition-colors duration-300">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">Dispute #{d.id} (Agreement #{d.agreementId})</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        d.state === 0 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                          : 'bg-green-500/10 text-green-400 border border-green-500/20'
                      }`}>
                        {d.state === 0 ? 'Active Dispute' : 'Resolved'}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850/80 space-y-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                        <AlertCircle className="h-4 w-4 text-rose-400" />
                        <span>Dispute claim reason:</span>
                      </div>
                      <p className="text-sm text-slate-200 font-medium bg-slate-900 p-2.5 rounded border border-slate-850 break-words italic">"{d.reason}"</p>
                      
                      <div className="grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-3 text-xs">
                        <div>
                          <span className="text-slate-500 block font-semibold uppercase">Total Locked</span>
                          <span className="text-sm font-bold text-white">{d.amount} XLM</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block font-semibold uppercase">Tenant</span>
                          <span className="text-xs font-mono text-slate-400 block">{d.tenant.substring(0, 4)}...{d.tenant.substring(d.tenant.length - 4)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Resolution Form */}
                    {d.state === 0 && (
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850/80 space-y-4">
                        <span className="text-xs font-bold text-indigo-300 uppercase block">Arbiter Resolution Split</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-500">Pay to Landlord</label>
                            <input
                              type="number"
                              placeholder="Landlord share"
                              value={resolutions[d.id]?.landlord || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const calculatedTenant = Math.max(0, d.amount - parseFloat(val || '0'));
                                setResolutions({
                                  ...resolutions,
                                  [d.id]: { landlord: val, tenant: isNaN(calculatedTenant) ? '' : calculatedTenant.toString() }
                                });
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-500">Refund to Tenant</label>
                            <input
                              type="number"
                              placeholder="Tenant share"
                              value={resolutions[d.id]?.tenant || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const calculatedLandlord = Math.max(0, d.amount - parseFloat(val || '0'));
                                setResolutions({
                                  ...resolutions,
                                  [d.id]: { landlord: isNaN(calculatedLandlord) ? '' : calculatedLandlord.toString(), tenant: val }
                                });
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => handleResolveDispute(d.id, d.amount)}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3 rounded-lg text-xs"
                        >
                          Execute Resolution Split
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
