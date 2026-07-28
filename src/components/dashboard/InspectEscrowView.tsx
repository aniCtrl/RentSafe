'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
import ActivityFeed from '@/components/ActivityFeed';
import TransactionCenter from '@/components/TransactionCenter';
import { ContractService } from '@/services/contractService';
import { readContractView, NATIVE_XLM_ID } from '@/lib/stellar';
import { useAppStore } from '@/store/useAppStore';
import { useAgreementDetails, useAgreementDispute } from '@/hooks/useChainQueries';
import {
  AGREEMENT_STATUS_LABELS,
  formatStroopsToXlm,
  formatTimestamp,
  formatAgreementId,
  parseAgreementSlug,
  shortAddress,
} from '@/lib/rentsafe';

const WalletConnectModal = dynamic(() => import('@/components/WalletConnectModal'), { ssr: false });
const RentPaymentPanel = dynamic(() => import('@/components/dashboard/RentPaymentPanel'), { ssr: false });


type InspectEscrowViewProps = {
  agreementId?: string;
};

export default function InspectEscrowView({ agreementId }: InspectEscrowViewProps) {
  const queryClient = useQueryClient();
  const {
    address,
    setEscrowId,
    setEscrowInfo,
    setBalance,
    addTransaction,
    updateTransactionStatus,
  } = useAppStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [actionTx, setActionTx] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deductionAmount, setDeductionAmount] = useState('0');
  const [deductionReason, setDeductionReason] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeEvidenceRef, setDisputeEvidenceRef] = useState('');
  const [additionalEvidenceRef, setAdditionalEvidenceRef] = useState('');

  const numericAgreementId = useMemo(() => parseAgreementSlug(agreementId || ''), [agreementId]);
  const isValidAgreementId = Number.isFinite(numericAgreementId) && numericAgreementId > 0;

  const {
    data: agreement,
    isLoading: loadingAgreement,
    error: agreementError,
    refetch: refetchAgreement,
  } = useAgreementDetails(isValidAgreementId ? numericAgreementId : null);

  const {
    data: dispute,
    isLoading: loadingDispute,
    refetch: refetchDispute,
  } = useAgreementDispute(isValidAgreementId ? numericAgreementId : null);

  useEffect(() => {
    if (!agreement) return;
    setEscrowInfo(agreement);
    setEscrowId(String(agreement.agreementId));
  }, [agreement, setEscrowId, setEscrowInfo]);

  useEffect(() => {
    if (agreement) {
      setDeductionAmount(formatStroopsToXlm(agreement.deductionAmount));
      setDeductionReason(agreement.deductionReason);
    }
  }, [agreement]);

  const role = useMemo(() => {
    if (!address || !agreement) return 'Guest';
    if (address.toLowerCase() === agreement.landlord.toLowerCase()) return 'Landlord';
    if (address.toLowerCase() === agreement.tenant.toLowerCase()) return 'Tenant';
    return 'Viewer';
  }, [address, agreement]);

  const refreshAll = async () => {
    await Promise.all([
      refetchAgreement(),
      refetchDispute(),
      queryClient.invalidateQueries({ queryKey: ['userAgreements'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] }),
      queryClient.invalidateQueries({ queryKey: ['platformStats'] }),
      queryClient.invalidateQueries({ queryKey: ['allDisputes'] }),
    ]);

    if (address) {
      try {
        const balanceValue = await readContractView(NATIVE_XLM_ID, 'balance', [address]);
        setBalance((Number(balanceValue) / 10000000).toFixed(2));
      } catch (balanceError) {
        console.error('Failed to fetch user balance:', balanceError);
      }
    }
  };

  const runTrackedAction = async (
    actionName: string,
    txType: string,
    action: () => Promise<string>,
  ) => {
    if (!address) {
      setModalOpen(true);
      return;
    }

    const txId = `${txType}-${numericAgreementId}-${Date.now()}`;

    try {
      setActionLoading(actionName);
      setActionError(null);
      setActionTx(null);
      addTransaction({
        id: txId,
        hash: '',
        type: txType,
        status: 'processing',
        description: `${actionName} for agreement #${numericAgreementId}`,
        agreementId: String(numericAgreementId),
      });

      const txHash = await action();
      setActionTx(txHash);
      updateTransactionStatus(txId, 'confirmed', txHash);
      await refreshAll();
    } catch (error) {
      console.error(error);
      updateTransactionStatus(txId, 'failed');
      setActionError(error instanceof Error ? error.message : `${actionName} failed`);
    } finally {
      setActionLoading(null);
    }
  };

  if (!agreementId) {
    return (
      <>
        <div className="bg-[#ffffff] rounded-[24px] p-8 text-center border border-[#e2e2e2] text-[#585f6c] shadow-sm">
          <span className="material-symbols-outlined text-4xl mb-3">search</span>
          <h3 className="text-base font-bold text-[#000000] mb-2">No Agreement Loaded</h3>
          <p className="text-xs text-[#585f6c]">Use the header search or the dashboard to open an agreement by its on-chain agreement ID.</p>
        </div>
        <WalletConnectModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  return (
    <>
      {actionError && (
        <div className="bg-[#ffdad6]/40 border border-[#ba1a1a]/20 text-[#ba1a1a] p-4 rounded-2xl text-xs mb-6 flex flex-col gap-2">
          <p className="font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">error</span> Error Occurred
          </p>
          <p>{actionError}</p>
        </div>
      )}

      {actionTx && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs mb-6 flex flex-col gap-2">
          <p className="font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">check_circle</span> Transaction Confirmed
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

      <div className="space-y-6 animate-fadeIn">
        {loadingAgreement ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#585f6c]">
            <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-semibold">Fetching agreement state from Soroban RPC...</p>
          </div>
        ) : agreementError || !agreement ? (
          <div className="bg-[#ffffff] rounded-[24px] p-8 text-center border border-[#e2e2e2] text-[#585f6c] shadow-sm">
            <span className="material-symbols-outlined text-4xl mb-3">search_off</span>
            <h3 className="text-base font-bold text-[#000000] mb-2">Agreement Not Found</h3>
            <p className="text-xs text-[#585f6c]">This agreement could not be loaded. Verify the agreement ID and try again.</p>
          </div>
        ) : (
          <div className="space-y-6">
          <div className="bg-[#ffffff] rounded-[24px] p-6 shadow-sm border border-[#e2e2e2] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#000000]">
                  {formatAgreementId(agreement.agreementId, agreement.createdAt)}
                </h3>
                {(role === 'Landlord' || role === 'Tenant') ? (
                  <div className="flex items-center gap-1.5 text-xs text-[#585f6c] mt-1 font-semibold">
                    <span className="material-symbols-outlined text-sm">apartment</span>
                    <span>{agreement.propertyDetails}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-[#747878] mt-1">
                    <span className="material-symbols-outlined text-sm">lock</span>
                    <span>Property details — visible to landlord &amp; tenant only</span>
                  </div>
                )}
                <div className="text-xs text-[#585f6c] font-mono mt-1 select-all">Shared contract: {agreement.contractId}</div>
              </div>

              <div className="flex flex-col items-end shrink-0">
                <span className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider mb-1">Deposit</span>
                <span className="text-2xl font-black text-[#000000]">{formatStroopsToXlm(agreement.depositAmount)} XLM</span>
                <div className="mt-2 bg-[#f3f3f3] border border-[#c4c7c7]/50 rounded-full px-3 py-1 text-[10px] font-bold uppercase text-[#000000] flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-[#000000] rounded-full" />
                  <span>State: {AGREEMENT_STATUS_LABELS[agreement.status]}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#ffffff] p-5 rounded-2xl border border-[#e2e2e2]">
                <h4 className="text-xs font-bold text-[#585f6c] mb-3 uppercase">Parties</h4>
                <div className="space-y-2 text-xs">
                  <p><span className="font-semibold text-black">Landlord:</span> <span className="font-mono break-all">{agreement.landlord}</span></p>
                  <p><span className="font-semibold text-black">Tenant:</span> <span className="font-mono break-all">{agreement.tenant}</span></p>
                </div>
              </div>
              <div className="bg-[#ffffff] p-5 rounded-2xl border border-[#e2e2e2]">
                <h4 className="text-xs font-bold text-[#585f6c] mb-3 uppercase">Terms</h4>
                <div className="space-y-2 text-xs text-[#585f6c]">
                  <p><span className="font-semibold text-black">Rent:</span> {formatStroopsToXlm(agreement.rentAmount)} XLM</p>
                  <p><span className="font-semibold text-black">Lease Start:</span> {formatTimestamp(agreement.leaseStart)}</p>
                  <p><span className="font-semibold text-black">Lease End:</span> {formatTimestamp(agreement.leaseEnd)}</p>
                </div>
              </div>
              <div className="bg-[#ffffff] p-5 rounded-2xl border border-[#e2e2e2]">
                <h4 className="text-xs font-bold text-[#585f6c] mb-3 uppercase">Current Viewer</h4>
                <p className="text-sm font-semibold text-[#000000]">{role}</p>
                <p className="text-[10px] text-[#747878] mt-1">Only authorized parties can submit lifecycle transactions.</p>
              </div>
            </div>

            <div className="bg-[#ffffff] rounded-[24px] p-6 shadow-sm border border-[#e2e2e2] space-y-6">
              <h3 className="text-sm font-bold text-[#000000] border-b border-[#e2e2e2] pb-3">Agreement Actions (Your Role: {role})</h3>

              {(agreement.status === 0 || agreement.status === 1 || agreement.status === 2) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 p-4 bg-[#f3f3f3] rounded-2xl border border-[#e2e2e2]">
                    <h4 className="text-xs font-bold text-[#000000]">Deposit Lock</h4>
                    <p className="text-[10px] text-[#585f6c]">Tenant locks the deposit funds into the single shared escrow contract.</p>
                    <button
                      disabled={actionLoading !== null || role !== 'Tenant' || agreement.status !== 0}
                      onClick={() => runTrackedAction('Lock Deposit', 'lock_deposit', () => ContractService.lockDeposit(agreement.agreementId, address))}
                      className="bg-black text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity w-full"
                    >
                      {actionLoading === 'Lock Deposit' ? 'Submitting...' : agreement.status === 0 ? 'Lock Deposit' : 'Deposit Already Locked'}
                    </button>
                  </div>

                  <div className="space-y-4 p-4 bg-[#f3f3f3] rounded-2xl border border-[#e2e2e2]">
                    <h4 className="text-xs font-bold text-[#000000]">Move-Out Settlement</h4>
                    <p className="text-[10px] text-[#585f6c]">At move-out, the landlord decides the deposit outcome: approve a full tenant refund, or propose a deduction.</p>
                    <button
                      disabled={actionLoading !== null || role !== 'Landlord' || ![1, 2].includes(agreement.status)}
                      onClick={() => runTrackedAction('Request Full Refund', 'request_full_refund', () => ContractService.requestFullRefund(agreement.agreementId, address))}
                      className="bg-black text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity w-full"
                    >
                      {actionLoading === 'Request Full Refund' ? 'Submitting...' : 'Approve Full Tenant Refund'}
                    </button>

                    <div className="space-y-3 pt-3 border-t border-[#c4c7c7]/50">
                      <div>
                        <label className="text-[10px] text-[#585f6c] block mb-1">Deduction Amount (XLM)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={deductionAmount}
                          onChange={(event) => setDeductionAmount(event.target.value)}
                          className="w-full text-xs p-2.5 border border-[#c4c7c7] rounded-xl bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#585f6c] block mb-1">Reason</label>
                        <textarea
                          value={deductionReason}
                          onChange={(event) => setDeductionReason(event.target.value)}
                          className="w-full text-xs p-2.5 border border-[#c4c7c7] rounded-xl bg-white focus:outline-none min-h-24"
                          placeholder="Describe the claimed deduction"
                        />
                      </div>
                      <button
                        disabled={actionLoading !== null || role !== 'Landlord' || ![1, 2].includes(agreement.status)}
                        onClick={() => {
                          if ((parseFloat(deductionAmount || '0') || 0) <= 0) {
                            setActionError('Enter a deduction amount greater than 0 XLM.');
                            return;
                          }
                          if (!deductionReason.trim()) {
                            setActionError('Please provide a deduction reason before submitting.');
                            return;
                          }
                          void runTrackedAction('Request Deduction', 'request_deduction', () =>
                            ContractService.requestDeduction(
                              agreement.agreementId,
                              {
                                amount: BigInt(Math.round(parseFloat(deductionAmount || '0') * 10000000)),
                                reason: deductionReason,
                              },
                              address,
                            ),
                          );
                        }}
                        className="bg-[#151c27] text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity w-full"
                      >
                        {actionLoading === 'Request Deduction' ? 'Submitting...' : 'Request Deduction'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {agreement.status === 4 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-[#f3f3f3] rounded-2xl border border-[#e2e2e2] space-y-3">
                    <h4 className="text-xs font-bold text-[#000000]">Pending Deduction Request</h4>
                    <p className="text-xs text-[#585f6c]">Amount requested: <span className="font-semibold text-black">{formatStroopsToXlm(agreement.deductionAmount)} XLM</span></p>
                    <p className="text-xs text-[#585f6c]">Reason: <span className="text-black">{agreement.deductionReason || '—'}</span></p>
                    <p className="text-[10px] text-[#747878]">Requested at: {formatTimestamp(agreement.deductionRequestedAt)}</p>
                  </div>
                  <div className="p-4 bg-[#f3f3f3] rounded-2xl border border-[#e2e2e2] space-y-3">
                    <h4 className="text-xs font-bold text-[#000000]">Tenant Response</h4>
                    <button
                      disabled={actionLoading !== null || role !== 'Tenant'}
                      onClick={() => runTrackedAction('Accept Deduction', 'respond_to_deduction', () => ContractService.respondToDeduction(agreement.agreementId, true, address))}
                      className="bg-black text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity w-full"
                    >
                      {actionLoading === 'Accept Deduction' ? 'Submitting...' : 'Accept Deduction'}
                    </button>
                    <button
                      disabled={actionLoading !== null || role !== 'Tenant'}
                      onClick={() => runTrackedAction('Reject Deduction', 'respond_to_deduction', () => ContractService.respondToDeduction(agreement.agreementId, false, address))}
                      className="bg-[#ba1a1a] text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity w-full"
                    >
                      {actionLoading === 'Reject Deduction' ? 'Submitting...' : 'Reject Deduction'}
                    </button>
                  </div>
                </div>
              )}

              {(agreement.status === 3 || agreement.status === 5) && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-emerald-900">Ready to Settle</h4>
                  <p className="text-xs text-emerald-900">
                    On-chain resolution recorded: {formatStroopsToXlm(agreement.resolutionLandlordAmount)} XLM to landlord and {formatStroopsToXlm(agreement.resolutionTenantAmount)} XLM to tenant.
                  </p>
                  <button
                    disabled={actionLoading !== null || (role !== 'Landlord' && role !== 'Tenant')}
                    onClick={() => runTrackedAction('Settle Agreement', 'settle', () => ContractService.settle(agreement.agreementId, address))}
                    className="bg-black text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {actionLoading === 'Settle Agreement' ? 'Submitting...' : 'Settle Funds'}
                  </button>
                </div>
              )}
            </div>

            {(agreement.status >= 6 || agreement.hasDispute || dispute) && (
              <div className="bg-[#ffffff] rounded-[24px] p-6 shadow-sm border border-[#e2e2e2] space-y-5">
                <div className="flex items-start justify-between gap-4 border-b border-[#e2e2e2] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#000000]">Dispute</h3>
                    <p className="text-[10px] text-[#747878] mt-1">Real-time state from the linked Dispute contract.</p>
                  </div>
                  {loadingDispute && <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>}
                </div>

                {agreement.status === 6 && !dispute && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900">
                      Deduction rejected. Either landlord or tenant can now raise a dispute and provide the first evidence reference.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-[#585f6c] block mb-1">Reason / Description</label>
                        <textarea
                          value={disputeReason}
                          onChange={(event) => setDisputeReason(event.target.value)}
                          className="w-full text-xs p-2.5 border border-[#c4c7c7] rounded-xl bg-white focus:outline-none min-h-24"
                          placeholder="Explain why the deduction is being disputed"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#585f6c] block mb-1">Evidence Reference</label>
                        <textarea
                          value={disputeEvidenceRef}
                          onChange={(event) => setDisputeEvidenceRef(event.target.value)}
                          className="w-full text-xs p-2.5 border border-[#c4c7c7] rounded-xl bg-white focus:outline-none min-h-24"
                          placeholder="Paste a doc link, IPFS hash, or short evidence description"
                        />
                      </div>
                    </div>
                    <button
                      disabled={actionLoading !== null || (role !== 'Landlord' && role !== 'Tenant')}
                      onClick={() => {
                        if (!disputeReason.trim()) {
                          setActionError('Please provide a dispute reason.');
                          return;
                        }
                        if (!disputeEvidenceRef.trim()) {
                          setActionError('Please provide an initial evidence reference.');
                          return;
                        }
                        void runTrackedAction('Raise Dispute', 'raise_dispute', async () => {
                          const result = await ContractService.raiseDispute(
                            agreement.agreementId,
                            {
                              raisedBy: address,
                              reason: disputeReason,
                              evidenceRef: disputeEvidenceRef,
                            },
                            address,
                          );
                          return result.txHash;
                        });
                      }}
                      className="bg-[#ba1a1a] text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {actionLoading === 'Raise Dispute' ? 'Submitting...' : 'Raise Dispute'}
                    </button>
                  </div>
                )}

                {dispute && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="bg-[#f3f3f3] rounded-2xl border border-[#e2e2e2] p-4">
                        <p className="text-[10px] uppercase font-bold text-[#585f6c] mb-1">Dispute ID</p>
                        <p className="font-semibold text-black">#{dispute.disputeId}</p>
                      </div>
                      <div className="bg-[#f3f3f3] rounded-2xl border border-[#e2e2e2] p-4">
                        <p className="text-[10px] uppercase font-bold text-[#585f6c] mb-1">Current State</p>
                        <p className="font-semibold text-black">{dispute.statusLabel}</p>
                      </div>
                      <div className="bg-[#f3f3f3] rounded-2xl border border-[#e2e2e2] p-4">
                        <p className="text-[10px] uppercase font-bold text-[#585f6c] mb-1">Raised By</p>
                        <p className="font-mono text-black break-all">{dispute.raisedBy}</p>
                      </div>
                    </div>

                    <div className="bg-[#f3f3f3] rounded-2xl border border-[#e2e2e2] p-4 text-xs text-[#585f6c]">
                      <p className="font-semibold text-black mb-1">Reason</p>
                      <p>{dispute.reason || '—'}</p>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-[#000000] mb-3">Evidence Submitted</h4>
                      {dispute.evidence.length === 0 ? (
                        <div className="text-xs text-[#585f6c] bg-[#f3f3f3] border border-[#e2e2e2] rounded-2xl p-4">No evidence entries recorded on-chain yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {dispute.evidence.map((entry, index) => (
                            <div key={`${entry.submitter}-${entry.submittedAt}-${index}`} className="bg-[#f3f3f3] border border-[#e2e2e2] rounded-2xl p-4 text-xs space-y-2">
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#585f6c]">
                                <span className="font-semibold text-black">{shortAddress(entry.submitter)}</span>
                                <span>•</span>
                                <span>{formatTimestamp(entry.submittedAt)}</span>
                              </div>
                              <p className="text-[#1a1c1c] break-words">{entry.evidenceRef}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {dispute.status !== 2 && (role === 'Landlord' || role === 'Tenant') && (
                      <div className="space-y-3 pt-2 border-t border-[#e2e2e2]">
                        <label className="text-[10px] text-[#585f6c] block">Submit Additional Evidence</label>
                        <textarea
                          value={additionalEvidenceRef}
                          onChange={(event) => setAdditionalEvidenceRef(event.target.value)}
                          className="w-full text-xs p-2.5 border border-[#c4c7c7] rounded-xl bg-white focus:outline-none min-h-24"
                          placeholder="Add another document link, IPFS hash, or evidence note"
                        />
                        <button
                          disabled={actionLoading !== null}
                          onClick={() => {
                            if (!additionalEvidenceRef.trim()) {
                              setActionError('Please enter an evidence reference before submitting.');
                              return;
                            }
                            void runTrackedAction('Submit Evidence', 'submit_evidence', () =>
                              ContractService.submitDisputeEvidence(
                                dispute.disputeId,
                                { submitter: address, evidenceRef: additionalEvidenceRef },
                                address,
                              ),
                            );
                          }}
                          className="bg-black text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {actionLoading === 'Submit Evidence' ? 'Submitting...' : 'Submit Additional Evidence'}
                        </button>
                      </div>
                    )}

                    {dispute.hasOutcome && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950">
                        <p className="font-bold mb-1">Resolved Outcome</p>
                        <p>
                          Resolved: {formatStroopsToXlm(dispute.outcomeLandlordAmount)} XLM to landlord, {formatStroopsToXlm(dispute.outcomeTenantAmount)} XLM to tenant — {agreement.statusLabel}
                        </p>
                        <p className="mt-1 text-[10px]">Resolved at: {formatTimestamp(dispute.outcomeResolvedAt)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {agreement.hasResolution && (
              <div className="bg-[#ffffff] rounded-[24px] p-6 shadow-sm border border-[#e2e2e2] text-xs text-[#585f6c] space-y-2">
                <h3 className="text-sm font-bold text-black">Recorded Resolution</h3>
                <p>
                  <span className="font-semibold text-black">Landlord:</span> {formatStroopsToXlm(agreement.resolutionLandlordAmount)} XLM
                </p>
                <p>
                  <span className="font-semibold text-black">Tenant:</span> {formatStroopsToXlm(agreement.resolutionTenantAmount)} XLM
                </p>
                <p>
                  <span className="font-semibold text-black">Source:</span> {agreement.resolutionSourceLabel}
                </p>
                <p>
                  <span className="font-semibold text-black">Timestamp:</span> {formatTimestamp(agreement.resolutionAt)}
                </p>
              </div>
            )}

            {agreement.status === 2 && address && (
              <RentPaymentPanel
                agreement={agreement}
                walletAddress={address}
                onPaymentComplete={(txHash) => {
                  setActionTx(txHash);
                  void refreshAll();
                }}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <ActivityFeed agreementId={numericAgreementId} disputeId={dispute?.disputeId} />
              <TransactionCenter agreementId={numericAgreementId} />
            </div>
          </div>
        )}
      </div>

      <WalletConnectModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
