'use client';

import React from 'react';
import { useAppStore, TransactionRecord } from '@/store/useAppStore';

export default function TransactionCenter() {
  const { transactions, clearTransactions } = useAppStore();

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
          <span>Transaction Console</span>
        </h4>
        {transactions.length > 0 && (
          <button 
            onClick={clearTransactions}
            className="text-[10px] font-bold text-[#ba1a1a] uppercase tracking-wider hover:underline"
          >
            Clear Log
          </button>
        )}
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-8 text-xs text-[#585f6c]">
          No local transactions submitted in this session.
        </div>
      ) : (
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
          {transactions.map((tx) => (
            <div 
              key={tx.id} 
              className={`p-4 rounded-xl border text-xs flex flex-col gap-2 ${getStatusColor(tx.status)}`}
            >
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
                <div className="flex justify-between items-center pt-2 border-t border-[#c4c7c7]/20 font-mono text-[10px]">
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

              {tx.status === 'failed' && (
                <button 
                  onClick={() => alert('To retry, please re-submit the corresponding action from the contract console.')}
                  className="mt-1 bg-black text-white py-1 px-3 rounded-lg text-[10px] font-bold self-start hover:opacity-90"
                >
                  Retry Action
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
