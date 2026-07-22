'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';

export default function TransactionCenter({ agreementId }: { agreementId?: string | number | null }) {
  const { transactions, clearTransactions } = useAppStore();
  const scopeKey = agreementId != null ? String(agreementId) : null;
  const scopedTransactions = scopeKey
    ? transactions.filter((transaction) => transaction.agreementId === scopeKey)
    : transactions;

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
    <div className="bg-[#ffffff] rounded-[24px] p-6 border border-[#e2e2e2] shadow-sm">
      <div className="flex justify-between items-center mb-6 border-b border-[#e2e2e2] pb-3">
        <h4 className="text-sm font-bold text-[#000000] flex items-center gap-1.5">
          <span className="material-symbols-outlined text-lg">receipt_long</span>
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
        <div className="text-center py-8 text-xs text-[#585f6c]">
          {scopeKey ? 'No signed transactions submitted in this session for this agreement.' : 'No signed transactions submitted in this session yet.'}
        </div>
      ) : (
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
          {scopedTransactions.map((tx) => (
            <div key={tx.id} className={`p-4 rounded-xl border text-xs flex flex-col gap-2 ${getStatusColor(tx.status)}`}>
              <div className="flex justify-between items-center">
                <span className="font-bold uppercase tracking-wider text-[10px]">{tx.type}</span>
                <span className="flex items-center gap-1 font-semibold text-[10px]">
                  <span className={`material-symbols-outlined text-sm ${tx.status === 'processing' ? 'animate-spin' : ''}`}>
                    {getStatusIcon(tx.status)}
                  </span>
                  <span className="uppercase">{tx.status}</span>
                </span>
              </div>

              <p className="text-slate-700">{tx.description}</p>

              {tx.hash && (
                <div className="flex justify-between items-center pt-2 border-t border-[#c4c7c7]/20 font-mono text-[10px] gap-2">
                  <span className="truncate max-w-[200px]">Hash: {tx.hash}</span>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-bold text-black flex items-center gap-0.5 hover:opacity-80"
                  >
                    Explorer <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
