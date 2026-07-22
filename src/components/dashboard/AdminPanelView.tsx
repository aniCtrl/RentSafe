'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAllDisputes, useAgreementDetails } from '@/hooks/useChainQueries';
import { ContractService } from '@/services/contractService';
import { DEFAULT_PLATFORM_ADMIN_ID, NATIVE_XLM_ID, readContractView } from '@/lib/stellar';
import { useAppStore } from '@/store/useAppStore';
import { formatStroopsToXlm, formatTimestamp, shortAddress } from '@/lib/rentsafe';

export default function AdminPanelView() {
  const queryClient = useQueryClient();
  const { address, setBalance, addTransaction, updateTransactionStatus } = useAppStore();
  const [selectedDisputeId, setSelectedDisputeId] = useState<number | null>(null);
  const [landlordAmount, setLandlordAmount] = useState('0');
  const [tenantAmount, setTenantAmount] = useState('0');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionTx, setActionTx] = useState<string | null>(null);

  const isAdmin = !!address && address.toLowerCase() === DEFAULT_PLATFORM_ADMIN_ID.toLowerCase();
  const { data: disputes = [], isLoading, error, refetch } = useAllDisputes(isAdmin);

  const openDisputes = useMemo(
    () => disputes.filter((dispute) => dispute.statusLabel === 'Open' || dispute.statusLabel === 'EvidenceSubmitted'),
    [disputes],
  );
  const resolvedDisputes = useMemo(() => disputes.filter((dispute) => dispute.statusLabel === 'Resolved'), [disputes]);
  const selectedDispute = useMemo(
    () => disputes.find((dispute) => dispute.disputeId === selectedDisputeId) ?? openDisputes[0] ?? resolvedDisputes[0] ?? null,
    [disputes, openDisputes, resolvedDisputes, selectedDisputeId],
  );

  const { data: selectedAgreement } = useAgreementDetails(selectedDispute?.agreementId ?? null);

  useEffect(() => {
    if (!selectedDisputeId && (openDisputes[0] || resolvedDisputes[0])) {
      setSelectedDisputeId((openDisputes[0] || resolvedDisputes[0])?.disputeId ?? null);
    }
  }, [openDisputes, resolvedDisputes, selectedDisputeId]);

  useEffect(() => {
    if (selectedAgreement) {
      const deposit = Number(selectedAgreement.depositAmount) / 10000000;
      setTenantAmount(deposit.toFixed(2));
      setLandlordAmount('0');
    }
  }, [selectedAgreement?.agreementId]);

  const refreshAll = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['agreementDetails'] }),
      queryClient.invalidateQueries({ queryKey: ['agreementDispute'] }),
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
        console.error('Failed to refresh admin wallet balance:', balanceError);
      }
    }
  };

  const handleResolve = async () => {
    if (!selectedDispute || !selectedAgreement || !address) return;

    const landlordRaw = BigInt(Math.round(parseFloat(landlordAmount || '0') * 10000000));
    const tenantRaw = BigInt(Math.round(parseFloat(tenantAmount || '0') * 10000000));
    const total = landlordRaw + tenantRaw;

    if (total !== selectedAgreement.depositAmount) {
      setActionError(`Resolution split must total exactly ${formatStroopsToXlm(selectedAgreement.depositAmount)} XLM.`);
      return;
    }

    const txId = `admin-resolve-${selectedDispute.disputeId}-${Date.now()}`;

    try {
      setActionLoading(true);
      setActionError(null);
      setActionTx(null);
      addTransaction({
        id: txId,
        hash: '',
        type: 'resolve_dispute',
        status: 'processing',
        description: `Resolving dispute #${selectedDispute.disputeId}`,
        agreementId: String(selectedDispute.agreementId),
      });

      const txHash = await ContractService.resolveDispute(
        selectedDispute.disputeId,
        { landlordAmount: landlordRaw, tenantAmount: tenantRaw },
        address,
      );

      setActionTx(txHash);
      updateTransactionStatus(txId, 'confirmed', txHash);
      await refreshAll();
    } catch (resolveError) {
      console.error(resolveError);
      updateTransactionStatus(txId, 'failed');
      setActionError(resolveError instanceof Error ? resolveError.message : 'Dispute resolution failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-[#ffffff] rounded-[24px] p-8 border border-[#e2e2e2] shadow-sm text-center text-[#585f6c]">
        <span className="material-symbols-outlined text-4xl mb-3">admin_panel_settings</span>
        <h3 className="text-base font-bold text-[#000000] mb-2">Access restricted — admin only</h3>
        <p className="text-xs max-w-md mx-auto">
          Connect the configured platform admin wallet to access the dispute arbitration panel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {actionError && <div className="bg-[#ffdad6]/40 border border-[#ba1a1a]/20 text-[#ba1a1a] p-4 rounded-2xl text-xs">{actionError}</div>}
      {actionTx && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl text-xs">
          Resolution submitted successfully.{' '}
          <a href={`https://stellar.expert/explorer/testnet/tx/${actionTx}`} target="_blank" rel="noreferrer" className="underline font-semibold">
            View transaction
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[360px,1fr] gap-6">
        <div className="space-y-6">
          <section className="bg-[#ffffff] rounded-[24px] p-6 border border-[#e2e2e2] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-black uppercase tracking-wider">Open Disputes</h3>
              {isLoading && <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>}
            </div>

            {error ? (
              <p className="text-xs text-[#ba1a1a]">Failed to load disputes from Soroban RPC.</p>
            ) : openDisputes.length === 0 ? (
              <p className="text-xs text-[#585f6c]">No open disputes.</p>
            ) : (
              <div className="space-y-3">
                {openDisputes.map((dispute) => (
                  <button
                    key={dispute.disputeId}
                    onClick={() => setSelectedDisputeId(dispute.disputeId)}
                    className={`w-full text-left border rounded-2xl p-4 transition-colors ${selectedDispute?.disputeId === dispute.disputeId ? 'border-black bg-[#f3f3f3]' : 'border-[#e2e2e2] hover:border-black'}`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="text-xs font-bold text-black">Dispute #{dispute.disputeId}</p>
                        <p className="text-[10px] text-[#585f6c] mt-1">Agreement #{dispute.agreementId}</p>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#585f6c]">{dispute.statusLabel}</span>
                    </div>
                    <p className="text-xs text-[#1a1c1c] mt-3 line-clamp-2">{dispute.reason}</p>
                    <div className="mt-3 text-[10px] text-[#585f6c] space-y-1">
                      <p>Landlord: {shortAddress(dispute.landlord)}</p>
                      <p>Tenant: {shortAddress(dispute.tenant)}</p>
                      <p>Evidence entries: {dispute.evidence.length}</p>
                      {dispute.evidence.slice(0, 2).map((entry, index) => (
                        <p key={`${entry.submitter}-${index}`} className="truncate">• {entry.evidenceRef}</p>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="bg-[#ffffff] rounded-[24px] p-6 border border-[#e2e2e2] shadow-sm">
            <h3 className="text-sm font-bold text-black uppercase tracking-wider mb-4">Resolved Disputes</h3>
            {resolvedDisputes.length === 0 ? (
              <p className="text-xs text-[#585f6c]">No resolved disputes yet.</p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {resolvedDisputes.map((dispute) => (
                  <button
                    key={dispute.disputeId}
                    onClick={() => setSelectedDisputeId(dispute.disputeId)}
                    className={`w-full text-left border rounded-2xl p-4 transition-colors ${selectedDispute?.disputeId === dispute.disputeId ? 'border-black bg-[#f3f3f3]' : 'border-[#e2e2e2] hover:border-black'}`}
                  >
                    <p className="text-xs font-bold text-black">Dispute #{dispute.disputeId}</p>
                    <p className="text-[10px] text-[#585f6c] mt-1">Agreement #{dispute.agreementId}</p>
                    <p className="text-xs text-[#1a1c1c] mt-2">
                      {formatStroopsToXlm(dispute.outcomeLandlordAmount)} XLM to landlord / {formatStroopsToXlm(dispute.outcomeTenantAmount)} XLM to tenant
                    </p>
                    {dispute.resolutionTxHash && (
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${dispute.resolutionTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex mt-2 text-[10px] underline font-semibold"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Stellar.expert
                      </a>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="bg-[#ffffff] rounded-[24px] p-6 border border-[#e2e2e2] shadow-sm">
          {!selectedDispute ? (
            <div className="text-center py-12 text-[#585f6c] text-xs">Select a dispute to inspect details and resolve it.</div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-black">Dispute #{selectedDispute.disputeId}</h2>
                <p className="text-xs text-[#585f6c] mt-1">Agreement #{selectedDispute.agreementId} • {selectedDispute.statusLabel}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#f3f3f3] border border-[#e2e2e2] rounded-2xl p-4 text-xs space-y-2">
                  <h4 className="font-bold text-black">Agreement Terms</h4>
                  {selectedAgreement ? (
                    <>
                      <p><span className="font-semibold text-black">Property:</span> {selectedAgreement.propertyDetails}</p>
                      <p><span className="font-semibold text-black">Deposit:</span> {formatStroopsToXlm(selectedAgreement.depositAmount)} XLM</p>
                      <p><span className="font-semibold text-black">Rent:</span> {formatStroopsToXlm(selectedAgreement.rentAmount)} XLM</p>
                      <p><span className="font-semibold text-black">Landlord:</span> <span className="font-mono break-all">{selectedAgreement.landlord}</span></p>
                      <p><span className="font-semibold text-black">Tenant:</span> <span className="font-mono break-all">{selectedAgreement.tenant}</span></p>
                    </>
                  ) : (
                    <p className="text-[#585f6c]">Loading agreement details...</p>
                  )}
                </div>

                <div className="bg-[#f3f3f3] border border-[#e2e2e2] rounded-2xl p-4 text-xs space-y-2">
                  <h4 className="font-bold text-black">Deduction Context</h4>
                  {selectedAgreement ? (
                    <>
                      <p><span className="font-semibold text-black">Requested Deduction:</span> {formatStroopsToXlm(selectedAgreement.deductionAmount)} XLM</p>
                      <p><span className="font-semibold text-black">Reason:</span> {selectedAgreement.deductionReason || '—'}</p>
                      <p><span className="font-semibold text-black">Raised:</span> {formatTimestamp(selectedDispute.createdAt)}</p>
                    </>
                  ) : (
                    <p className="text-[#585f6c]">Loading deduction details...</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-black">Evidence</h4>
                {selectedDispute.evidence.length === 0 ? (
                  <div className="bg-[#f3f3f3] border border-[#e2e2e2] rounded-2xl p-4 text-xs text-[#585f6c]">No evidence submitted.</div>
                ) : (
                  selectedDispute.evidence.map((entry, index) => (
                    <div key={`${entry.submitter}-${entry.submittedAt}-${index}`} className="bg-[#f3f3f3] border border-[#e2e2e2] rounded-2xl p-4 text-xs space-y-2">
                      <div className="flex flex-wrap gap-2 text-[10px] text-[#585f6c]">
                        <span className="font-semibold text-black">{shortAddress(entry.submitter)}</span>
                        <span>•</span>
                        <span>{formatTimestamp(entry.submittedAt)}</span>
                      </div>
                      <p className="text-[#1a1c1c] break-words">{entry.evidenceRef}</p>
                    </div>
                  ))
                )}
              </div>

              {selectedDispute.statusLabel !== 'Resolved' && selectedAgreement && (
                <div className="space-y-4 border-t border-[#e2e2e2] pt-5">
                  <h4 className="text-sm font-bold text-black">Resolution Form</h4>
                  <p className="text-xs text-[#585f6c]">
                    Specify the final split outcome. It must total exactly {formatStroopsToXlm(selectedAgreement.depositAmount)} XLM.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#585f6c] mb-1.5">Landlord Amount (XLM)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={landlordAmount}
                        onChange={(event) => {
                          const nextLandlord = parseFloat(event.target.value) || 0;
                          const total = Number(selectedAgreement.depositAmount) / 10000000;
                          setLandlordAmount(event.target.value);
                          setTenantAmount(Math.max(0, total - nextLandlord).toFixed(2));
                        }}
                        className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#585f6c] mb-1.5">Tenant Amount (XLM)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={tenantAmount}
                        onChange={(event) => {
                          const nextTenant = parseFloat(event.target.value) || 0;
                          const total = Number(selectedAgreement.depositAmount) / 10000000;
                          setTenantAmount(event.target.value);
                          setLandlordAmount(Math.max(0, total - nextTenant).toFixed(2));
                        }}
                        className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000]"
                      />
                    </div>
                  </div>
                  <button
                    disabled={actionLoading}
                    onClick={handleResolve}
                    className="bg-black text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {actionLoading ? 'Submitting Resolution...' : 'Resolve Dispute'}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
