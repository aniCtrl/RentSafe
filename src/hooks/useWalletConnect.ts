'use client';

import { useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { NATIVE_XLM_ID, initializeWalletsKit, readContractView } from '@/lib/stellar';

export function useWalletConnect() {
  const {
    address,
    setAddress,
    setBalance,
    network,
    walletId,
    setWalletId,
    resetSession,
  } = useAppStore();

  const [connecting, setConnecting] = useState(false);

  const fetchBalance = useCallback(async (userAddress: string) => {
    try {
      const balVal = await readContractView(NATIVE_XLM_ID, 'balance', [userAddress]);
      setBalance((Number(balVal) / 10_000_000).toFixed(2));
    } catch (balErr) {
      console.error('Failed to load user balance:', balErr);
      setBalance('0.00');
    }
  }, [setBalance]);

  const connectWallet = useCallback(async (onClose?: () => void) => {
    if (connecting) return;
    setConnecting(true);

    try {
      await initializeWalletsKit(network);
      const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');

      const res = await StellarWalletsKit.authModal();
      if (res && res.address) {
        const selectedId = StellarWalletsKit.selectedModule.productId;
        setWalletId(selectedId);
        setAddress(res.address);
        await fetchBalance(res.address);
      }
    } catch (err: any) {
      console.error('StellarWalletsKit connection failed:', err);
      if (err?.message !== 'The user closed the modal.') {
        const errMsg = err instanceof Error ? err.message : String(err?.message || err || 'Connection failed');
        alert(`Wallet Connection Error: ${errMsg}`);
      }
    } finally {
      setConnecting(false);
      if (onClose) onClose();
    }
  }, [connecting, network, setAddress, setWalletId, fetchBalance]);

  const bootstrapSession = useCallback(async () => {
    if (!address || !walletId) return;

    try {
      await initializeWalletsKit(network, walletId);
    } catch (err) {
      console.error('Failed to restore wallet signer:', err);
      resetSession();
      return;
    }

    await fetchBalance(address);
  }, [address, network, walletId, fetchBalance, resetSession]);

  return {
    connecting,
    connectWallet,
    bootstrapSession,
  };
}
