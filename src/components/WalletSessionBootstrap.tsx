'use client';

import { useEffect, useCallback } from 'react';
import { useWalletConnect } from '@/hooks/useWalletConnect';
import { useAppStore } from '@/store/useAppStore';

export default function WalletSessionBootstrap() {
  const { bootstrapSession } = useWalletConnect();
  const { address, walletId, setAddress, setBalance } = useAppStore();

  useEffect(() => {
    bootstrapSession();
  }, [bootstrapSession]);

  const checkAccountChange = useCallback(async () => {
    if (!address || !walletId) return;
    try {
      const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');
      // Fetch current active address directly from the wallet module
      const res = await StellarWalletsKit.fetchAddress();
      const currentPubKey = res?.address;
      if (currentPubKey && currentPubKey !== address) {
        console.log('Account switch detected:', address, '->', currentPubKey);
        setAddress(currentPubKey);
        // Also fetch updated balance
        const { readContractView, NATIVE_XLM_ID } = await import('@/lib/stellar');
        try {
          const balVal = await readContractView(NATIVE_XLM_ID, 'balance', [currentPubKey]);
          setBalance((Number(balVal) / 10_000_000).toFixed(2));
        } catch (balErr) {
          console.error('Failed to load user balance on account switch:', balErr);
          setBalance('0.00');
        }
      }
    } catch (err) {
      // Silent catch to prevent showing connection modals or dialogs on focus changes
      console.debug('Failed to check account switch:', err);
    }
  }, [address, walletId, setAddress, setBalance]);

  useEffect(() => {
    if (!address || !walletId) return;

    // Check account on window focus
    window.addEventListener('focus', checkAccountChange);

    // Also check on a periodic interval (every 5 seconds)
    const interval = setInterval(checkAccountChange, 5000);

    return () => {
      window.removeEventListener('focus', checkAccountChange);
      clearInterval(interval);
    };
  }, [address, walletId, checkAccountChange]);

  return null;
}
