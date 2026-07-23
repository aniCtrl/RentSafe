'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { sendXlmTransfer } from '@/lib/stellar';

export interface RentPaymentRecord {
  txHash: string;
  paidAt: number;
  amountStroops: string;
  month: number;
}

const STORAGE_KEY_PREFIX = 'rentsafe-rent-payments-';

function loadPayments(agreementId: number): RentPaymentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${agreementId}`);
    return raw ? (JSON.parse(raw) as RentPaymentRecord[]) : [];
  } catch {
    return [];
  }
}

function savePayments(agreementId: number, payments: RentPaymentRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${agreementId}`,
      JSON.stringify(payments),
    );
  } catch {
    // localStorage may be full or unavailable
  }
}

function calculateNextDueDate(leaseStartSeconds: number, paidMonths: number[]): Date {
  const leaseStart = new Date(leaseStartSeconds * 1000);
  const now = new Date();

  const monthsElapsed =
    (now.getFullYear() - leaseStart.getFullYear()) * 12 +
    (now.getMonth() - leaseStart.getMonth());

  for (let monthIndex = 0; monthIndex <= monthsElapsed + 1; monthIndex++) {
    if (!paidMonths.includes(monthIndex)) {
      const dueDate = new Date(leaseStart);
      dueDate.setMonth(dueDate.getMonth() + monthIndex);
      return dueDate;
    }
  }

  const nextDate = new Date(leaseStart);
  nextDate.setMonth(nextDate.getMonth() + paidMonths.length);
  return nextDate;
}

function formatCountdown(targetDate: Date): string {
  const diffMs = targetDate.getTime() - Date.now();
  if (diffMs <= 0) return 'Due now';

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface UseRentPaymentsOptions {
  agreementId: number;
  leaseStartSeconds: number;
  leaseEndSeconds: number;
  rentAmountStroops: bigint;
  tenantAddress: string;
  landlordAddress: string;
  walletAddress: string;
}

export function useRentPayments({
  agreementId,
  leaseStartSeconds,
  leaseEndSeconds,
  rentAmountStroops,
  tenantAddress,
  landlordAddress,
  walletAddress,
}: UseRentPaymentsOptions) {
  const [payments, setPayments] = useState<RentPaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    setPayments(loadPayments(agreementId));
  }, [agreementId]);

  const paidMonths = useMemo(() => payments.map((p) => p.month), [payments]);

  const nextDueDate = useMemo(
    () => calculateNextDueDate(leaseStartSeconds, paidMonths),
    [leaseStartSeconds, paidMonths],
  );

  const currentMonthIndex = useMemo(() => {
    const leaseStart = new Date(leaseStartSeconds * 1000);
    const now = new Date();
    return (
      (now.getFullYear() - leaseStart.getFullYear()) * 12 +
      (now.getMonth() - leaseStart.getMonth())
    );
  }, [leaseStartSeconds]);

  const isDue = useMemo(
    // eslint-disable-next-line react-hooks/purity
    () => !paidMonths.includes(currentMonthIndex) && Date.now() / 1000 >= leaseStartSeconds,
    [paidMonths, currentMonthIndex, leaseStartSeconds],
  );

  const isLeaseEnded = useMemo(
    // eslint-disable-next-line react-hooks/purity
    () => Date.now() / 1000 > leaseEndSeconds,
    [leaseEndSeconds],
  );

  const isTenant = useMemo(
    () => !!walletAddress && walletAddress.toLowerCase() === tenantAddress.toLowerCase(),
    [walletAddress, tenantAddress],
  );

  useEffect(() => {
    setCountdown(formatCountdown(nextDueDate));
    const interval = setInterval(() => {
      setCountdown(formatCountdown(nextDueDate));
    }, 30_000);
    return () => clearInterval(interval);
  }, [nextDueDate]);

  const payRent = useCallback(async () => {
    if (!isTenant || loading) return;
    setLoading(true);
    setError(null);
    setLastTxHash(null);

    try {
      const txHash = await sendXlmTransfer(walletAddress, landlordAddress, rentAmountStroops);

      const newPayment: RentPaymentRecord = {
        txHash,
        paidAt: Date.now(),
        amountStroops: String(rentAmountStroops),
        month: currentMonthIndex,
      };

      setPayments((prev) => {
        const updated = [newPayment, ...prev];
        savePayments(agreementId, updated);
        return updated;
      });

      setLastTxHash(txHash);
    } catch (err) {
      const { translateStellarError } = await import('@/lib/errors');
      setError(translateStellarError(err));
    } finally {
      setLoading(false);
    }
  }, [isTenant, loading, walletAddress, landlordAddress, rentAmountStroops, currentMonthIndex, agreementId]);

  return {
    payments,
    loading,
    error,
    lastTxHash,
    countdown,
    nextDueDate,
    isDue,
    isLeaseEnded,
    isTenant,
    currentMonthIndex,
    payRent,
  };
}
