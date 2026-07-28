'use client';

import React from 'react';
import AppShell from '@/components/app/AppShell';
import ActivityFeed from '@/components/ActivityFeed';

export default function ActivityFeedPage() {
  return (
    <AppShell title="Activity Feed">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-[#ffffff] rounded-[24px] p-6 border border-[#e2e2e2] shadow-sm">
          <h2 className="text-xl font-black text-black mb-1">Global Activity Feed</h2>
          <p className="text-xs text-[#585f6c]">Real-time events streamed directly from the Stellar blockchain ledger for all RentSafe agreements.</p>
        </div>
        <ActivityFeed />
      </div>
    </AppShell>
  );
}
