'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import ActivityFeed from '@/components/ActivityFeed';
import TransactionCenter from '@/components/TransactionCenter';
import { ContractService } from '@/services/contractService';
import { useInspectEscrow } from '@/hooks/useInspectEscrow';
import { DEFAULT_ESCROW_ID, DEFAULT_DISPUTE_ID } from '@/lib/stellar';
import {
  agreementStatusDisplayLabel,
  formatStroopsToXlm,
  formatTimestamp,
  formatAgreementId,
  shortAddress,
} from '@/lib/rentsafe';
import DisputeTimeline from '@/components/DisputeTimeline';
import CopyHashButton from '@/components/CopyHashButton';

const WalletConnectModal = dynamic(() => import('@/components/WalletConnectModal'), { ssr: false });
const RentPaymentPanel = dynamic(() => import('@/components/dashboard/RentPaymentPanel'), { ssr: false });

type InspectEscrowViewProps = {
  agreementId?: string;
};

export default function InspectEscrowView({ agreementId }: InspectEscrowViewProps) {
  const {
    address,
    role,
    agreement,
    dispute,
    loadingAgreement,
    agreementError,
    loadingDispute,
    disputeError,
    modalOpen,
    setModalOpen,
    actionTx,
    setActionTx,
    actionError,
    setActionError,
    actionLoading,
    deductionAmount,
    setDeductionAmount,
    deductionReason,
    setDeductionReason,
    disputeReason,
    setDisputeReason,
    disputeEvidenceRef,
    setDisputeEvidenceRef,
    additionalEvidenceRef,
    setAdditionalEvidenceRef,
    mutualLandlordAmount,
    setMutualLandlordAmount,
    mutualTenantAmount,
    setMutualTenantAmount,
    settlementReason,
    setSettlementReason,
    numericAgreementId,
    refreshAll,
    runTrackedAction,
  } = useInspectEscrow(agreementId);

  const mutualProposal = dispute?.mutualResolution ?? null;
  const currentProposal = dispute?.currentSettlementProposal ?? null;
  const settlementHistory = dispute?.settlementProposals ?? [];
  const canResolveMutually = role === 'Landlord' || role === 'Tenant';
  const [showCounterOffer, setShowCounterOffer] = React.useState(false);
  const proposalIsFromOtherParticipant = Boolean(
    currentProposal && address && currentProposal.proposer.toLowerCase() !== address.toLowerCase(),
  );
  const legacyPendingProposal = !currentProposal && settlementHistory.length === 0 && mutualProposal;

  React.useEffect(() => {
    setShowCounterOffer(false);
  }, [dispute?.disputeId, currentProposal?.proposalId]);

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
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono break-all">Hash: {actionTx}</p>
            <CopyHashButton hash={actionTx} />
          </div>
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
            <div className="bg-[#ffffff] rounded-[24px] p-6 shadow-sm border border-[#e2e2e2] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e2e2] pb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#000000]">
                    {formatAgreementId(agreement.agreementId, agreement.createdAt)}
                  </h3>
                  {(role === 'Landlord' || role === 'Tenant') ? (
                    <div className="flex items-center gap-1.5 text-xs text-[#585f6c] mt-0.5 font-semibold">
                      <span className="material-symbols-outlined text-sm">apartment</span>
                      <span>{agreement.propertyDetails}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-[#747878] mt-0.5">
                      <span className="material-symbols-outlined text-sm">lock</span>
                      <span>Property details — visible to landlord &amp; tenant only</span>
                    </div>
                  )}
                </div>

                <div className="bg-[#f3f3f3] border border-[#c4c7c7]/50 rounded-full px-3 py-1 text-[10px] font-bold uppercase text-[#000000] flex items-center gap-1.5 shrink-0">
                  <div className="w-1.5 h-1.5 bg-[#000000] rounded-full" />
                  <span>State: {agreementStatusDisplayLabel(agreement.status)}</span>
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pt-1">
                <div>
                  <span className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider block mb-1">Locked Deposit</span>
                  <span className="text-2xl md:text-3xl font-black text-[#000000] block">{formatStroopsToXlm(agreement.depositAmount)} XLM</span>
                </div>

                <div className="w-full md:w-auto text-xs text-[#585f6c] bg-[#f8f9fa] border border-[#e2e2e2] rounded-xl p-3">
                  <span className="text-[10px] font-bold text-[#747878] uppercase tracking-wider block mb-0.5">Shared Escrow Contract</span>
                  <span className="font-mono text-[11px] text-[#000000] break-all select-all block">{agreement.contractId}</span>
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

            <DisputeTimeline agreement={agreement} dispute={dispute} role={role} disputeLoading={loadingDispute} disputeError={disputeError ? String(disputeError) : null} />

            <div className="bg-[#ffffff] rounded-[24px] p-6 shadow-sm border border-[#e2e2e2] space-y-6">
              <h3 className="text-sm font-bold text-[#000000] border-b border-[#e2e2e2] pb-3">Agreement Actions (Your Role: {role})</h3>

              {(agreement.status === 0 || agreement.status === 1 || agreement.status === 2) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 p-4 bg-[#f3f3f3] rounded-2xl border border-[#e2e2e2]">
                    <h4 className="text-xs font-bold text-[#000000]">Deposit Lock</h4>
                    <p className="text-[10px] text-[#585f6c]">Tenant locks the deposit funds into the single shared escrow contract.</p>
                    <button
                      disabled={actionLoading !== null || role !== 'Tenant' || agreement.status !== 0}
                      onClick={() => runTrackedAction(
                        'Lock Deposit', 
                        'lock_deposit', 
                        () => ContractService.lockDeposit(agreement.agreementId, address),
                        { contractId: DEFAULT_ESCROW_ID, method: 'lock_deposit', args: [agreement.agreementId] }
                      )}
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
                      onClick={() => runTrackedAction(
                        'Request Full Refund', 
                        'request_full_refund', 
                        () => ContractService.requestFullRefund(agreement.agreementId, address),
                        { contractId: DEFAULT_ESCROW_ID, method: 'request_full_refund', args: [agreement.agreementId] }
                      )}
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
                          void runTrackedAction(
                            'Request Deduction', 
                            'request_deduction', 
                            () => ContractService.requestDeduction(
                              agreement.agreementId,
                              {
                                amount: BigInt(Math.round(parseFloat(deductionAmount || '0') * 10_000_000)),
                                reason: deductionReason,
                              },
                              address,
                            ),
                            {
                              contractId: DEFAULT_ESCROW_ID,
                              method: 'request_deduction',
                              args: [
                                agreement.agreementId,
                                BigInt(Math.round(parseFloat(deductionAmount || '0') * 10_000_000)),
                                deductionReason,
                              ]
                            }
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
                      onClick={() => runTrackedAction(
                        'Accept Deduction', 
                        'respond_to_deduction', 
                        () => ContractService.respondToDeduction(agreement.agreementId, true, address),
                        { contractId: DEFAULT_ESCROW_ID, method: 'respond_to_deduction', args: [agreement.agreementId, true] }
                      )}
                      className="bg-black text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity w-full"
                    >
                      {actionLoading === 'Accept Deduction' ? 'Submitting...' : 'Accept Deduction'}
                    </button>
                    <button
                      disabled={actionLoading !== null || role !== 'Tenant'}
                      onClick={() => runTrackedAction(
                        'Reject Deduction', 
                        'respond_to_deduction', 
                        () => ContractService.respondToDeduction(agreement.agreementId, false, address),
                        { contractId: DEFAULT_ESCROW_ID, method: 'respond_to_deduction', args: [agreement.agreementId, false] }
                      )}
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
                    onClick={() => runTrackedAction(
                      'Settle Agreement', 
                      'settle', 
                      () => ContractService.settle(agreement.agreementId, address),
                      { contractId: DEFAULT_ESCROW_ID, method: 'settle', args: [agreement.agreementId] }
                    )}
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
                          placeholder="Paste a Google Drive link, IPFS hash, document link, or short evidence description"
                        />
                        <a
                          href="https://drive.google.com/drive/my-drive"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[#c4c7c7] bg-[#f9f9f9] px-3 py-2 text-[#585f6c] transition-colors hover:bg-[#eeeeee]"
                        >
                          <span className="material-symbols-outlined text-base">add_to_drive</span>
                          <span className="text-left">
                            <span className="block text-[10px] font-bold">Add evidence with Google Drive</span>
                            <span className="block text-[9px]">Upload your photo/document to Google Drive, copy its share link, and paste it into the field above.</span>
                          </span>
                          <span className="text-[10px] font-bold">Open Google Drive ↗</span>
                        </a>
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
                        void runTrackedAction(
                          'Raise Dispute', 
                          'raise_dispute', 
                          async () => {
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
                          },
                          {
                            contractId: DEFAULT_ESCROW_ID,
                            method: 'raise_dispute',
                            args: [agreement.agreementId, address, disputeReason, disputeEvidenceRef]
                          }
                        );
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
                              <p className="text-[#1a1c1c] break-all">{entry.evidenceRef}</p>
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
                            void runTrackedAction(
                              'Submit Evidence', 
                              'submit_evidence', 
                              () => ContractService.submitDisputeEvidence(
                                dispute.disputeId,
                                { submitter: address, evidenceRef: additionalEvidenceRef },
                                address,
                              ),
                              {
                                contractId: DEFAULT_DISPUTE_ID,
                                method: 'submit_evidence',
                                args: [dispute.disputeId, address, additionalEvidenceRef]
                              }
                            );
                          }}
                          className="bg-black text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {actionLoading === 'Submit Evidence' ? 'Submitting...' : 'Submit Additional Evidence'}
                        </button>
                      </div>
                    )}

                    {canResolveMutually && (
                      <div className="status-info space-y-5 rounded-2xl border p-4">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-xs font-bold text-primary">Negotiated mutual settlement</h4>
                            <span className="rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wider">Funds locked</span>
                          </div>
                          <p className="mt-1 text-[10px] text-muted">
                            Make, reject, or counter a structured split without moving money. The escrow is paid only after the other participant accepts one pending proposal.
                          </p>
                        </div>

                        {currentProposal && dispute.status !== 2 && (
                          <div className="surface-card space-y-4 rounded-xl border p-4 text-xs">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-primary">Current proposal · Pending</p>
                                <p className="mt-1 text-[10px] text-muted">
                                  Proposed by {shortAddress(currentProposal.proposer)} · {formatTimestamp(currentProposal.proposedAt)}
                                </p>
                              </div>
                              <span className="status-warning rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wider">Awaiting response</span>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="surface-muted rounded-xl border p-3">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-muted">Landlord receives</p>
                                <p className="mt-1 text-base font-bold text-primary">{formatStroopsToXlm(currentProposal.landlordAmount)} XLM</p>
                              </div>
                              <div className="surface-muted rounded-xl border p-3">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-muted">Tenant receives</p>
                                <p className="mt-1 text-base font-bold text-primary">{formatStroopsToXlm(currentProposal.tenantAmount)} XLM</p>
                              </div>
                            </div>

                            {currentProposal.reason && (
                              <p className="text-[10px] text-muted"><span className="font-semibold text-primary">Reason:</span> {currentProposal.reason}</p>
                            )}

                            {proposalIsFromOtherParticipant ? (
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <button
                                  type="button"
                                  disabled={actionLoading !== null}
                                  onClick={() => void runTrackedAction(
                                    'Accept Settlement Proposal',
                                    'accept_settlement_proposal',
                                    () => ContractService.acceptSettlementProposal(dispute.disputeId, currentProposal.proposalId, address),
                                    { contractId: DEFAULT_DISPUTE_ID, method: 'accept_settlement_proposal', args: [address, dispute.disputeId, currentProposal.proposalId] },
                                  )}
                                  className="btn-primary rounded-xl px-3 py-2.5 text-xs font-bold hover:opacity-90 disabled:opacity-50"
                                >
                                  {actionLoading === 'Accept Settlement Proposal' ? 'Submitting…' : 'Accept & settle'}
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoading !== null}
                                  onClick={() => void runTrackedAction(
                                    'Reject Settlement Proposal',
                                    'reject_settlement_proposal',
                                    () => ContractService.rejectSettlementProposal(dispute.disputeId, currentProposal.proposalId, address),
                                    { contractId: DEFAULT_DISPUTE_ID, method: 'reject_settlement_proposal', args: [address, dispute.disputeId, currentProposal.proposalId] },
                                  )}
                                  className="btn-danger rounded-xl px-3 py-2.5 text-xs font-bold hover:opacity-90 disabled:opacity-50"
                                >
                                  {actionLoading === 'Reject Settlement Proposal' ? 'Submitting…' : 'Reject'}
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoading !== null}
                                  onClick={() => {
                                    setMutualLandlordAmount(formatStroopsToXlm(currentProposal.landlordAmount));
                                    setMutualTenantAmount(formatStroopsToXlm(currentProposal.tenantAmount));
                                    setSettlementReason('');
                                    setActionError(null);
                                    setShowCounterOffer(true);
                                  }}
                                  className="btn-secondary rounded-xl border px-3 py-2.5 text-xs font-bold hover:opacity-90 disabled:opacity-50"
                                >
                                  Counter-offer
                                </button>
                              </div>
                            ) : (
                              <p className="text-[10px] text-muted">Your proposal is pending. The other participant can accept, reject, or counter it.</p>
                            )}
                          </div>
                        )}

                        {dispute.status !== 2 && ((!currentProposal && !legacyPendingProposal) || (proposalIsFromOtherParticipant && showCounterOffer)) && (
                          <div className="surface-muted space-y-3 rounded-xl border p-4">
                            <div>
                              <h5 className="text-xs font-bold text-primary">{currentProposal ? 'Make a counter-offer' : 'Make a settlement proposal'}</h5>
                              <p className="mt-1 text-[10px] text-muted">The two payouts must equal the locked deposit of {formatStroopsToXlm(agreement.depositAmount)} XLM.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <label htmlFor="settlement-landlord-amount" className="text-[10px] text-muted">Landlord receives (XLM)</label>
                                <input
                                  id="settlement-landlord-amount"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={mutualLandlordAmount}
                                  onChange={(event) => {
                                    const nextLandlord = parseFloat(event.target.value) || 0;
                                    const total = Number(agreement.depositAmount) / 10_000_000;
                                    setMutualLandlordAmount(event.target.value);
                                    setMutualTenantAmount(Math.max(0, total - nextLandlord).toFixed(2));
                                  }}
                                  className="input-surface mt-1 w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                                />
                              </div>
                              <div>
                                <label htmlFor="settlement-tenant-amount" className="text-[10px] text-muted">Tenant receives (XLM)</label>
                                <input
                                  id="settlement-tenant-amount"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={mutualTenantAmount}
                                  onChange={(event) => {
                                    const nextTenant = parseFloat(event.target.value) || 0;
                                    const total = Number(agreement.depositAmount) / 10_000_000;
                                    setMutualTenantAmount(event.target.value);
                                    setMutualLandlordAmount(Math.max(0, total - nextTenant).toFixed(2));
                                  }}
                                  className="input-surface mt-1 w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label htmlFor="settlement-reason" className="text-[10px] text-muted">Optional reason (max 280 characters)</label>
                              <textarea
                                id="settlement-reason"
                                maxLength={280}
                                value={settlementReason}
                                onChange={(event) => setSettlementReason(event.target.value)}
                                className="input-surface mt-1 min-h-20 w-full rounded-xl border p-2.5 text-xs focus:outline-none"
                                placeholder="Briefly explain this offer"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={actionLoading !== null}
                              onClick={() => {
                                const landlordAmount = BigInt(Math.round((parseFloat(mutualLandlordAmount || '0') || 0) * 10_000_000));
                                const tenantAmount = BigInt(Math.round((parseFloat(mutualTenantAmount || '0') || 0) * 10_000_000));
                                if (landlordAmount + tenantAmount !== agreement.depositAmount) {
                                  setActionError(`Settlement split must total exactly ${formatStroopsToXlm(agreement.depositAmount)} XLM.`);
                                  return;
                                }
                                if (currentProposal) {
                                  void runTrackedAction(
                                    'Submit Counter-offer',
                                    'counter_settlement_proposal',
                                    async () => (await ContractService.counterSettlementProposal(
                                      dispute.disputeId,
                                      currentProposal.proposalId,
                                      { landlordAmount, tenantAmount, reason: settlementReason },
                                      address,
                                    )).txHash,
                                    { contractId: DEFAULT_DISPUTE_ID, method: 'counter_settlement_proposal', args: [address, dispute.disputeId, currentProposal.proposalId, landlordAmount, tenantAmount, settlementReason] },
                                  );
                                } else {
                                  void runTrackedAction(
                                    'Create Settlement Proposal',
                                    'create_settlement_proposal',
                                    async () => (await ContractService.createSettlementProposal(
                                      dispute.disputeId,
                                      { landlordAmount, tenantAmount, reason: settlementReason },
                                      address,
                                    )).txHash,
                                    { contractId: DEFAULT_DISPUTE_ID, method: 'create_settlement_proposal', args: [address, dispute.disputeId, landlordAmount, tenantAmount, settlementReason] },
                                  );
                                }
                              }}
                              className="btn-primary w-full rounded-xl px-4 py-2.5 text-xs font-bold hover:opacity-90 disabled:opacity-50"
                            >
                              {actionLoading === 'Submit Counter-offer' || actionLoading === 'Create Settlement Proposal' ? 'Submitting…' : currentProposal ? 'Submit Counter-offer' : 'Create Settlement Proposal'}
                            </button>
                          </div>
                        )}

                        {legacyPendingProposal && dispute.status !== 2 && (
                          <div className="surface-card space-y-3 rounded-xl border p-4 text-xs">
                            <p className="font-semibold text-primary">Legacy mutual settlement proposal</p>
                            <p className="text-muted">{formatStroopsToXlm(legacyPendingProposal.landlordAmount)} XLM to landlord · {formatStroopsToXlm(legacyPendingProposal.tenantAmount)} XLM to tenant</p>
                            <p className="text-[10px] text-subtle">Proposed by {shortAddress(legacyPendingProposal.proposedBy)} · {formatTimestamp(legacyPendingProposal.proposedAt)}</p>
                            {address && legacyPendingProposal.proposedBy.toLowerCase() !== address.toLowerCase() && (
                              <button
                                type="button"
                                disabled={actionLoading !== null}
                                onClick={() => void runTrackedAction(
                                  'Accept Legacy Settlement',
                                  'propose_mutual_resolution',
                                  () => ContractService.proposeMutualResolution(dispute.disputeId, { landlordAmount: legacyPendingProposal.landlordAmount, tenantAmount: legacyPendingProposal.tenantAmount }, address),
                                  { contractId: DEFAULT_DISPUTE_ID, method: 'propose_mutual_resolution', args: [address, dispute.disputeId, legacyPendingProposal.landlordAmount, legacyPendingProposal.tenantAmount] },
                                )}
                                className="btn-primary w-full rounded-xl px-4 py-2.5 text-xs font-bold hover:opacity-90 disabled:opacity-50"
                              >
                                {actionLoading === 'Accept Legacy Settlement' ? 'Submitting…' : 'Accept and settle legacy proposal'}
                              </button>
                            )}
                          </div>
                        )}

                        {settlementHistory.length > 0 && (
                          <div className="space-y-3 border-t border-default pt-4">
                            <div className="flex items-center justify-between gap-2">
                              <h5 className="text-xs font-bold text-primary">Negotiation history</h5>
                              <span className="text-[10px] text-muted">{settlementHistory.length} proposal{settlementHistory.length === 1 ? '' : 's'}</span>
                            </div>
                            <div className="space-y-2">
                              {settlementHistory.map((proposal) => (
                                <div key={proposal.proposalId} className="surface-card rounded-xl border p-3 text-xs">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-semibold text-primary">{shortAddress(proposal.proposer)} · {proposal.statusLabel}</p>
                                    <span className="text-[10px] text-subtle">{formatTimestamp(proposal.proposedAt)}</span>
                                  </div>
                                  <p className="mt-1 text-muted">{formatStroopsToXlm(proposal.landlordAmount)} XLM landlord · {formatStroopsToXlm(proposal.tenantAmount)} XLM tenant</p>
                                  {proposal.reason && <p className="mt-1 text-[10px] text-subtle">{proposal.reason}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {dispute.status === 2 && settlementHistory.length === 0 && !legacyPendingProposal && (
                          <p className="text-[10px] text-muted">This dispute is resolved. No negotiated proposal history was returned by the deployed contract.</p>
                        )}
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
                  <span className="font-semibold text-black">Source:</span> {agreement.resolutionSource === 2 ? 'Participant settlement' : agreement.resolutionSourceLabel}
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
