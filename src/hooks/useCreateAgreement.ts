'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { ContractService } from '@/services/contractService';
import { AgreementChainService } from '@/services/chain/agreementService';

const toUnixSeconds = (date: string, endOfDay = false) => {
  if (!date) return 0;
  const suffix = endOfDay ? 'T23:59:59Z' : 'T00:00:00Z';
  return Math.floor(new Date(`${date}${suffix}`).getTime() / 1000);
};

export function useCreateAgreement() {
  const router = useRouter();
  const { address, setEscrowId, addTransaction, updateTransactionStatus } = useAppStore();

  const [step, setStep] = useState(1);
  const [landlord, setLandlord] = useState('');
  const [tenant, setTenant] = useState('');
  const [propertyDetails, setPropertyDetails] = useState('');
  const [deposit, setDeposit] = useState('1000');
  const [rent, setRent] = useState('100');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [createdAgreementId, setCreatedAgreementId] = useState<number | null>(null);

  const sharedContractId = useMemo(() => AgreementChainService.getSharedContractId(), []);

  const handleSubmit = async (event: React.FormEvent, onModalOpen: () => void) => {
    event.preventDefault();

    if (!address) {
      onModalOpen();
      return;
    }

    if (!landlord || !tenant || !propertyDetails || !deposit || !rent || !startDate || !endDate) {
      setError('Please complete every required field before submitting.');
      return;
    }

    if (address.toLowerCase() !== landlord.toLowerCase()) {
      setError('The connected wallet must match the landlord address to create an agreement on-chain.');
      return;
    }

    const leaseStart = toUnixSeconds(startDate);
    const leaseEnd = toUnixSeconds(endDate, true);
    if (!leaseStart || !leaseEnd || leaseStart >= leaseEnd) {
      setError('Lease start must be earlier than lease end.');
      return;
    }

    const txId = `create-agreement-${Date.now()}`;

    try {
      setLoading(true);
      setError(null);
      addTransaction({
        id: txId,
        hash: '',
        type: 'create_agreement',
        status: 'processing',
        description: `Creating agreement for ${propertyDetails}`,
      });

      const result = await ContractService.createAgreement(
        {
          landlord,
          tenant,
          propertyDetails,
          depositAmount: BigInt(Math.round(parseFloat(deposit) * 10_000_000)),
          rentAmount: BigInt(Math.round(parseFloat(rent) * 10_000_000)),
          leaseStart,
          leaseEnd,
        },
        address,
      );

      let resolvedId = result.agreementId;
      if (!resolvedId || resolvedId <= 0) {
        try {
          const ids = await ContractService.getAgreementIds();
          if (ids.length > 0) {
            resolvedId = Math.max(...ids);
          }
        } catch (fallbackError) {
          console.warn('Could not resolve agreement ID via fallback:', fallbackError);
        }
      }

      setTxHash(result.txHash);
      setCreatedAgreementId(resolvedId);
      setEscrowId(String(resolvedId));
      updateTransactionStatus(txId, 'confirmed', result.txHash, { agreementId: String(resolvedId) });

      if (resolvedId > 0) {
        window.setTimeout(() => {
          router.push(`/inspect-escrow/${resolvedId}`);
        }, 2500);
      }
    } catch (submitError) {
      console.error(submitError);
      updateTransactionStatus(txId, 'failed');
      const { translateStellarError } = await import('@/lib/errors');
      setError(translateStellarError(submitError));
    } finally {
      setLoading(false);
    }
  };

  return {
    step,
    setStep,
    landlord,
    setLandlord,
    tenant,
    setTenant,
    propertyDetails,
    setPropertyDetails,
    deposit,
    setDeposit,
    rent,
    setRent,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    loading,
    error,
    setError,
    txHash,
    createdAgreementId,
    sharedContractId,
    handleSubmit,
  };
}
