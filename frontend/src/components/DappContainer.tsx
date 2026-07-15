'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWalletStore } from '../state/useWalletStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export function DappContainer({ children }: { children: React.ReactNode }) {
  const connect = useWalletStore((s) => s.connect);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const savedAddress = localStorage.getItem('rentsafe_address');
      const savedWalletId = localStorage.getItem('rentsafe_wallet_id');
      if (savedAddress && savedWalletId) {
        // Attempt to auto-restore session silently
        connect(savedWalletId).catch((err) => {
          console.warn('Silent session restore failed:', err);
        });
      }
    }
  }, [connect]);

  if (!mounted) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">Loading RentSafe...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
