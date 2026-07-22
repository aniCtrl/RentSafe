'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import ActivityFeed from '@/components/ActivityFeed';
import TransactionCenter from '@/components/TransactionCenter';
import { useUserAgreements, useDashboardMetrics } from '@/hooks/useChainQueries';
import { useAppStore } from '@/store/useAppStore';
import { AGREEMENT_STATUS_LABELS, formatStroopsToXlm } from '@/lib/rentsafe';

const WalletConnectModal = dynamic(() => import('@/components/WalletConnectModal'), { ssr: false });

export default function DashboardOverview() {
  const router = useRouter();
  const { address, escrowId, setEscrowId } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const { data: agreements = [], isLoading: loadingAgreements } = useUserAgreements(address);
  const { data: metrics, isLoading: loadingMetrics } = useDashboardMetrics(address);

  useEffect(() => {
    if (!escrowId && agreements.length > 0) {
      setEscrowId(String(agreements[0].agreementId));
    }
  }, [agreements, escrowId, setEscrowId]);

  return (
    <>
      <div className="space-y-8 animate-fadeIn">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#ffffff] p-6 rounded-[24px] border border-[#e2e2e2] shadow-sm">
            <p className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider mb-2">Total Value Locked</p>
            <p className="text-2xl font-black text-black">{loadingMetrics ? '...' : address ? metrics?.tvl || '0.00' : '0.00'} XLM</p>
            <p className="text-[10px] text-[#585f6c] mt-1">Your live locked deposits in the shared escrow contract</p>
          </div>
          <div className="bg-[#ffffff] p-6 rounded-[24px] border border-[#e2e2e2] shadow-sm">
            <p className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider mb-2">Active Agreements</p>
            <p className="text-2xl font-black text-black">{loadingMetrics ? '...' : address ? metrics?.activeCount || 0 : 0}</p>
            <p className="text-[10px] text-[#585f6c] mt-1">Contracts currently in active lease state</p>
          </div>
          <div className="bg-[#ffffff] p-6 rounded-[24px] border border-[#e2e2e2] shadow-sm">
            <p className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider mb-2">Awaiting Settlement</p>
            <p className="text-2xl font-black text-black">{loadingMetrics ? '...' : address ? metrics?.pendingCount || '0.00' : '0.00'} XLM</p>
            <p className="text-[10px] text-[#585f6c] mt-1">Agreements pending payout or arbitration completion</p>
          </div>
        </div>

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
              <p className="text-xs mb-6 max-w-sm mx-auto">Please connect your Stellar wallet to view your rental agreements.</p>
              <button onClick={() => setModalOpen(true)} className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90">
                Connect Wallet
              </button>
            </div>
          ) : agreements.length === 0 ? (
            <div className="bg-[#ffffff] rounded-[24px] p-8 text-center border border-[#e2e2e2] text-[#585f6c] shadow-sm">
              <span className="material-symbols-outlined text-4xl mb-3">gavel</span>
              <h3 className="text-base font-bold text-[#000000] mb-2">No Agreements Found</h3>
              <p className="text-xs mb-6 max-w-sm mx-auto">You do not have any agreements registered in the shared escrow contract yet.</p>
              <Link href="/create" className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90 inline-block">
                Create New Agreement
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agreements.map((agreement) => (
                <div
                  key={agreement.agreementId}
                  className="bg-white p-6 rounded-2xl border border-[#e2e2e2] shadow-sm flex flex-col justify-between min-h-52 hover:border-black transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h4 className="font-bold text-sm text-black">Agreement #{agreement.agreementId}</h4>
                        <p className="text-xs text-[#585f6c] mt-1">{agreement.propertyDetails || 'Property details unavailable'}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                          agreement.status === 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-[#dce2f3] text-[#5e6572]'
                        }`}
                      >
                        {AGREEMENT_STATUS_LABELS[agreement.status]}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs text-[#585f6c]">
                      <div>
                        <p className="font-semibold text-black">Deposit</p>
                        <p>{formatStroopsToXlm(agreement.depositAmount)} XLM</p>
                      </div>
                      <div>
                        <p className="font-semibold text-black">Rent</p>
                        <p>{formatStroopsToXlm(agreement.rentAmount)} XLM</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-[#e2e2e2] gap-3">
                    <span className="text-[10px] text-[#585f6c] font-semibold truncate">Shared contract: {agreement.contractId.slice(0, 8)}...{agreement.contractId.slice(-6)}</span>
                    <button
                      onClick={() => {
                        setEscrowId(String(agreement.agreementId));
                        router.push(`/inspect-escrow/${agreement.agreementId}`);
                      }}
                      className="bg-black text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold hover:opacity-90 shrink-0"
                    >
                      Inspect details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <ActivityFeed agreementId={escrowId || undefined} />
          <TransactionCenter />
        </div>
      </div>

      <WalletConnectModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
