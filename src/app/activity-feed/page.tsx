'use client';

import React from 'react';
import AppShell from '@/components/app/AppShell';
import ActivityFeed from '@/components/ActivityFeed';

export default function ActivityFeedPage() {
  return (
    <AppShell title="Activity Feed">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-[#ffffff] rounded-[24px] p-6 md:p-8 border border-[#e2e2e2] shadow-sm">
          <h2 className="text-2xl font-black text-black mb-1">Global Activity Feed</h2>
          <p className="text-sm text-[#585f6c]">Real-time events streamed directly from the Stellar blockchain ledger for all RentSafe agreements.</p>
        </div>
        <ActivityFeed maxHeightClass="min-h-[550px] max-h-[750px]" />
      </div>
    </AppShell>
  );
}
