'use client';

import { useEffect } from 'react';
import { useWalletConnect } from '@/hooks/useWalletConnect';

export default function WalletSessionBootstrap() {
  const { bootstrapSession } = useWalletConnect();

  useEffect(() => {
    bootstrapSession();
  }, [bootstrapSession]);

  return null;
}
