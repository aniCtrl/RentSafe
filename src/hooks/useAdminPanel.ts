'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/useAppStore';
import { useAllDisputes, useAgreementDetails } from '@/hooks/useChainQueries';
import { ContractService } from '@/services/contractService';
import { DEFAULT_PLATFORM_ADMIN_ID, NATIVE_XLM_ID, readContractView } from '@/lib/stellar';
import { formatStroopsToXlm } from '@/lib/rentsafe';

export function useAdminPanel() {
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
      const deposit = Number(selectedAgreement.depositAmount) / 10_000_000;
      setTenantAmount(deposit.toFixed(2));
      setLandlordAmount('0');
    }
  }, [selectedAgreement?.agreementId]);

  const refreshAll = useCallback(async () => {
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
        setBalance((Number(balanceValue) / 10_000_000).toFixed(2));
      } catch (balanceError) {
        console.error('Failed to refresh admin wallet balance:', balanceError);
      }
    }
  }, [address, refetch, queryClient, setBalance]);

  const handleResolve = useCallback(async () => {
    if (!selectedDispute || !selectedAgreement || !address) return;

    const landlordRaw = BigInt(Math.round(parseFloat(landlordAmount || '0') * 10_000_000));
    const tenantRaw = BigInt(Math.round(parseFloat(tenantAmount || '0') * 10_000_000));
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
  }, [selectedDispute, selectedAgreement, address, landlordAmount, tenantAmount, addTransaction, updateTransactionStatus, refreshAll]);

  return {
    isAdmin,
    disputes,
    isLoading,
    error,
    openDisputes,
    resolvedDisputes,
    selectedDispute,
    selectedAgreement,
    selectedDisputeId,
    setSelectedDisputeId,
    landlordAmount,
    setLandlordAmount,
    tenantAmount,
    setTenantAmount,
    actionLoading,
    actionError,
    actionTx,
    handleResolve,
    refreshAll,
  };
}
