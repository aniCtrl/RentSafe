'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/useAppStore';
import { useAgreementDetails, useAgreementDispute } from '@/hooks/useChainQueries';
import { readContractView, NATIVE_XLM_ID } from '@/lib/stellar';
import { parseAgreementSlug, formatStroopsToXlm } from '@/lib/rentsafe';
import type { TimelineRole } from '@/lib/disputeTimeline';

export function useInspectEscrow(agreementId?: string) {
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
  const [mutualLandlordAmount, setMutualLandlordAmount] = useState('0');
  const [mutualTenantAmount, setMutualTenantAmount] = useState('0');

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
    error: disputeError,
    refetch: refetchDispute,
  } = useAgreementDispute(isValidAgreementId ? numericAgreementId : null);
  const agreementDeposit = agreement?.depositAmount;

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

  useEffect(() => {
    if (agreementDeposit === undefined) return;
    setMutualLandlordAmount('0');
    setMutualTenantAmount(formatStroopsToXlm(agreementDeposit));
  }, [agreement?.agreementId, agreementDeposit, dispute?.disputeId]);

  const role = useMemo<TimelineRole>(() => {
    if (!address || !agreement) return 'Guest';
    if (address.toLowerCase() === agreement.landlord.toLowerCase()) return 'Landlord';
    if (address.toLowerCase() === agreement.tenant.toLowerCase()) return 'Tenant';
    return 'Viewer';
  }, [address, agreement]);

  const refreshAll = useCallback(async () => {
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
        setBalance((Number(balanceValue) / 10_000_000).toFixed(2));
      } catch (balanceError) {
        console.error('Failed to fetch user balance:', balanceError);
      }
    }
  }, [address, refetchAgreement, refetchDispute, queryClient, setBalance]);

  const runTrackedAction = useCallback(async (
    actionName: string,
    txType: string,
    action: () => Promise<string>,
    retryPayload?: {
      contractId: string;
      method: string;
      args: any[];
    }
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
        retryPayload,
      });

      const txHash = await action();
      setActionTx(txHash);
      updateTransactionStatus(txId, 'confirmed', txHash);
      await refreshAll();
    } catch (error) {
      console.error(error);
      updateTransactionStatus(txId, 'failed');
      const { translateStellarError } = await import('@/lib/errors');
      setActionError(translateStellarError(error));
    } finally {
      setActionLoading(null);
    }
  }, [address, numericAgreementId, addTransaction, updateTransactionStatus, refreshAll]);

  return {
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
    numericAgreementId,
    isValidAgreementId,
    refreshAll,
    runTrackedAction,
  };
}
