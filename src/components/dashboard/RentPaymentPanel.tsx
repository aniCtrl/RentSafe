'use client';

import React from 'react';
import { useRentPayments } from '@/hooks/useRentPayments';
import { formatStroopsToXlm, AgreementRecord } from '@/lib/rentsafe';
import CopyHashButton from '@/components/CopyHashButton';

interface RentPaymentPanelProps {
  agreement: AgreementRecord;
  walletAddress: string;
  onPaymentComplete?: (txHash: string) => void;
}

export default function RentPaymentPanel({ agreement, walletAddress, onPaymentComplete }: RentPaymentPanelProps) {
  const {
    payments,
    loading,
    error,
    lastTxHash,
    countdown,
    nextDueDate,
    isDue,
    isLeaseEnded,
    isTenant,
    payRent,
  } = useRentPayments({
    agreementId: agreement.agreementId,
    leaseStartSeconds: agreement.leaseStart,
    leaseEndSeconds: agreement.leaseEnd,
    rentAmountStroops: agreement.rentAmount,
    tenantAddress: agreement.tenant,
    landlordAddress: agreement.landlord,
    walletAddress,
  });

  React.useEffect(() => {
    if (lastTxHash && onPaymentComplete) {
      onPaymentComplete(lastTxHash);
    }
  }, [lastTxHash, onPaymentComplete]);

  if (!isTenant) return null;

  const rentXlm = formatStroopsToXlm(agreement.rentAmount);
  const nextDueDateStr = nextDueDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const statusBgClass = isDue
    ? 'bg-amber-50 border-amber-200'
    : 'bg-emerald-50 border-emerald-200';
  const statusTextClass = isDue ? 'text-amber-700' : 'text-emerald-700';
  const statusHeadClass = isDue ? 'text-amber-900' : 'text-emerald-900';
  const btnClass = isDue
    ? 'bg-black text-white hover:opacity-90 disabled:opacity-50'
    : 'bg-[#f3f3f3] text-[#585f6c] border border-[#e2e2e2] hover:bg-[#eeeeee] disabled:opacity-50';

  return (
    <div className="bg-[#ffffff] rounded-[24px] p-6 shadow-sm border border-[#e2e2e2] space-y-5">
      <div className="border-b border-[#e2e2e2] pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-lg text-[#000000]">payments</span>
          <h3 className="text-sm font-bold text-[#000000]">Monthly Rent Payments</h3>
        </div>
        <p className="text-[10px] text-[#747878] mt-1">
          Rent is sent directly to the landlord each month. Payments are recorded in your browser.
        </p>
      </div>

      {isLeaseEnded ? (
        <div className="bg-[#f3f3f3] border border-[#e2e2e2] rounded-2xl p-4 text-xs text-[#585f6c]">
          <span className="material-symbols-outlined text-sm mr-1 align-middle">event_busy</span>
          The lease has ended. No further rent payments are due.
        </div>
      ) : (
        <div className={`rounded-2xl p-4 border ${statusBgClass}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${statusTextClass}`}>
                {isDue ? 'Payment Due' : 'Next Payment'}
              </p>
              <p className={`text-sm font-bold ${statusHeadClass}`}>
                {isDue ? 'Due now' : `In ${countdown}`}
              </p>
              <p className={`text-[10px] mt-0.5 ${statusTextClass}`}>
                {nextDueDateStr}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider mb-1">Amount</p>
              <p className="text-xl font-black text-[#000000]">{rentXlm} XLM</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[#ffdad6]/40 border border-[#ba1a1a]/20 text-[#ba1a1a] p-3 rounded-xl text-xs">
          <span className="material-symbols-outlined text-sm mr-1 align-middle">error</span>
          {error}
        </div>
      )}

      {lastTxHash && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs space-y-1">
          <p className="font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Payment Sent!
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono break-all">Hash: {lastTxHash}</p>
            <CopyHashButton hash={lastTxHash} />
          </div>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${lastTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="underline font-semibold flex items-center gap-1 mt-1 text-emerald-950"
          >
            View on Stellar.expert <span className="material-symbols-outlined text-[10px]">open_in_new</span>
          </a>
        </div>
      )}

      {!isLeaseEnded && (
        <button
          onClick={payRent}
          disabled={loading}
          className={`w-full font-bold text-xs px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${btnClass}`}
        >
          <span className="material-symbols-outlined text-base">send</span>
          {loading ? 'Processing payment...' : isDue ? `Pay ${rentXlm} XLM Now` : `Pay Rent Early (${rentXlm} XLM)`}
        </button>
      )}

      {payments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[#000000]">Payment History ({payments.length})</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {payments.map((payment, idx) => (
              <div
                key={payment.txHash + idx}
                className="bg-[#f3f3f3] border border-[#e2e2e2] rounded-xl p-3 text-xs flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-black">
                    {(Number(payment.amountStroops) / 10_000_000).toFixed(2)} XLM
                  </p>
                  <p className="text-[10px] text-[#747878]">
                    {new Date(payment.paidAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <CopyHashButton hash={payment.txHash} compact />
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${payment.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[#585f6c] hover:text-black"
                    title="View on Stellar.expert"
                  >
                    <span className="material-symbols-outlined text-base">open_in_new</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {payments.length === 0 && !isLeaseEnded && (
        <p className="text-[10px] text-[#747878] text-center">No payments recorded yet.</p>
      )}
    </div>
  );
}
