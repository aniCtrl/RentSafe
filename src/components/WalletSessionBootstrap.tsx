'use client';

import { useEffect } from 'react';
import { initializeWalletsKit, NATIVE_XLM_ID, readContractView } from '@/lib/stellar';
import { useAppStore } from '@/store/useAppStore';

export default function WalletSessionBootstrap() {
  const { address, network, walletId, setBalance, resetSession } = useAppStore();

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!address || !walletId) return;

      try {
        await initializeWalletsKit(network, walletId);
      } catch (err) {
        console.error('Failed to restore wallet signer:', err);
        if (!cancelled) {
          resetSession();
        }
        return;
      }

      try {
        const balVal = await readContractView(NATIVE_XLM_ID, 'balance', [address]);
        if (!cancelled) {
          setBalance((Number(balVal) / 10000000).toFixed(2));
        }
      } catch (err) {
        console.error('Failed to refresh persisted wallet balance:', err);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [address, network, walletId, setBalance, resetSession]);

  return null;
}
