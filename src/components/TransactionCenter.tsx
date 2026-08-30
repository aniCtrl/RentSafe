'use client';

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore, TransactionRecord } from '@/store/useAppStore';
import { parseAgreementSlug } from '@/lib/rentsafe';
import CopyHashButton from '@/components/CopyHashButton';

export default function TransactionCenter({ agreementId }: { agreementId?: string | number | null }) {
  const queryClient = useQueryClient();
  const { transactions, address, updateTransactionStatus, clearTransactions, createNotification } = useAppStore();
  const parsedId = agreementId != null ? parseAgreementSlug(String(agreementId)) : NaN;
  const scopeKey = !isNaN(parsedId) ? String(parsedId) : (agreementId != null ? String(agreementId) : null);
  const scopedTransactions = scopeKey
    ? transactions.filter((transaction) => transaction.agreementId === scopeKey)
    : transactions;

  const handleRetry = async (tx: TransactionRecord) => {
    if (!tx.retryPayload || !address) return;
    const { contractId, method, args } = tx.retryPayload;

    updateTransactionStatus(tx.id, 'processing');

    try {
      const { writeContractMethod } = await import('@/lib/stellar');
      const txHash = await writeContractMethod(contractId, method, args, address);
      updateTransactionStatus(tx.id, 'confirmed', txHash);
      
      // Invalidate query state to refresh UI views
      await queryClient.invalidateQueries();
    } catch (err) {
      console.error('Retry failed:', err);
      updateTransactionStatus(tx.id, 'failed');
      const { translateStellarError } = await import('@/lib/errors');
      createNotification({
        id: `system:retry-failed:${tx.id}`,
        type: 'system',
        severity: 'error',
        title: 'Retry failed',
        message: `Retry transaction failed: ${translateStellarError(err)}`,
        agreementId: tx.agreementId,
        href: '/transaction-center',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200 animate-pulse';
      case 'confirmed':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'failed':
        return 'text-[#ba1a1a] bg-[#ffdad6]/40 border-[#ffdad6]';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'hourglass_empty';
      case 'processing':
        return 'sync';
      case 'confirmed':
        return 'check_circle';
      case 'failed':
        return 'error';
      default:
        return 'help';
    }
  };

  return (
    <div className="bg-[#ffffff] rounded-[24px] p-6 md:p-7 border border-[#e2e2e2] shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-5 border-b border-[#e2e2e2] pb-4">
          <h4 className="text-base font-extrabold text-[#000000] flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">receipt_long</span>
            <span>This Session&apos;s Transactions</span>
          </h4>
          {scopedTransactions.length > 0 && (
            <button
              onClick={() => clearTransactions(scopeKey ?? undefined)}
              className="text-[10px] font-bold text-[#ba1a1a] uppercase tracking-wider hover:underline"
            >
              Clear Log
            </button>
          )}
        </div>

        {scopedTransactions.length === 0 ? (
          <div className="text-center py-14 text-xs text-[#585f6c]">
            <span className="material-symbols-outlined text-3xl mb-2 text-slate-400">receipt</span>
            <p className="font-medium text-sm text-slate-700">No session transactions</p>
            <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
              {scopeKey ? 'No signed transactions submitted in this session for this agreement.' : 'No signed transactions submitted in this session yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5 min-h-[440px] max-h-[580px] overflow-y-auto pr-1">
            {scopedTransactions.map((tx) => (
              <div key={tx.id} className={`p-4 rounded-2xl border text-xs flex flex-col gap-2 ${getStatusColor(tx.status)}`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold uppercase tracking-wider text-[10px]">{tx.type}</span>
                  <span className="flex items-center gap-1 font-semibold text-[10px]">
                    <span className={`material-symbols-outlined text-sm ${tx.status === 'processing' ? 'animate-spin' : ''}`}>
                      {getStatusIcon(tx.status)}
                    </span>
                    <span className="uppercase">{tx.status}</span>
                  </span>
                </div>

                <p className="text-slate-700 leading-relaxed">{tx.description}</p>

                {tx.hash && (
                  <div className="flex flex-wrap justify-between items-center pt-2 border-t border-[#c4c7c7]/20 font-mono text-[10px] gap-2">
                    <span className="truncate max-w-[200px]">Hash: {tx.hash}</span>
                    <div className="flex items-center gap-2">
                      <CopyHashButton hash={tx.hash} />
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-bold text-black flex items-center gap-0.5 hover:opacity-80"
                      >
                        Explorer <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                      </a>
                    </div>
                  </div>
                )}

                {tx.status === 'failed' && tx.retryPayload && (
                  <button
                    onClick={() => handleRetry(tx)}
                    className="mt-2 bg-black text-white hover:opacity-85 font-bold px-3 py-1.5 rounded-lg self-start text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all"
                  >
                    <span className="material-symbols-outlined text-xs">replay</span>
                    <span>Retry Transaction</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
