'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { Loader2 } from 'lucide-react';

const RentSafePortal = dynamic(() => import('../components/RentSafePortal'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#F9F9F7] text-[#111111] flex flex-col items-center justify-center gap-4 sharp-corners">
      <Loader2 className="h-10 w-10 animate-spin text-[#CC0000] stroke-1" />
      <span className="font-serif text-lg italic">Loading RentSafe Gazette...</span>
    </div>
  )
});

export default function Home() {
  return <RentSafePortal />;
}
