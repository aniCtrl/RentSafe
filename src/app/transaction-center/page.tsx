'use client';

import React from 'react';
import AppShell from '@/components/app/AppShell';
import TransactionCenter from '@/components/TransactionCenter';

export default function TransactionCenterPage() {
  return (
    <AppShell title="Transaction Center">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-[#ffffff] rounded-[24px] p-6 border border-[#e2e2e2] shadow-sm">
          <h2 className="text-xl font-black text-black mb-1">Transaction Center</h2>
          <p className="text-xs text-[#585f6c]">Track the real-time status of your signed transactions, inspect block explorer logs, or retry failed on-chain contract submissions.</p>
        </div>
        <TransactionCenter />
      </div>
    </AppShell>
  );
}
