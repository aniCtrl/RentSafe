'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WalletSessionBootstrap from '@/components/WalletSessionBootstrap';
import { useAppStore } from '@/store/useAppStore';

function ThemeSync() {
  const themeMode = useAppStore((state) => state.themeMode);

  React.useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.classList.toggle('dark', themeMode === 'dark');
    document.documentElement.classList.toggle('light', themeMode === 'light');
    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <WalletSessionBootstrap />
      {children}
    </QueryClientProvider>
  );
}
