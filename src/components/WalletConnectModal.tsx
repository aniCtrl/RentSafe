'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { NATIVE_XLM_ID, initializeWalletsKit, readContractView } from '@/lib/stellar';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
  const { setAddress, setBalance, network, setWalletId } = useAppStore();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!isOpen || connecting) return;

    let cancelled = false;

    const connect = async () => {
      setConnecting(true);
      try {
        // 1. Initialize the official wallets kit with the active network settings
        await initializeWalletsKit(network);

        const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');

        // 2. Open the official UI modal for multi-wallet selection (Freighter, Albedo, xBull, Ledger, etc.)
        const res = await StellarWalletsKit.authModal();

        if (cancelled) return;

        if (res && res.address) {
          // 3. Extract and persist the active wallet name/ID and connected public address
          const selectedId = StellarWalletsKit.selectedModule.productId;
          setWalletId(selectedId);
          setAddress(res.address);

          // 4. Retrieve the user's native XLM balance on the blockchain
          try {
            const balVal = await readContractView(NATIVE_XLM_ID, 'balance', [res.address]);
            if (!cancelled) {
              setBalance((Number(balVal) / 10000000).toFixed(2));
            }
          } catch (balErr) {
            console.error('Failed to load user balance on connect:', balErr);
            if (!cancelled) {
              setBalance('0.00');
            }
          }
        }
      } catch (err: any) {
        console.error('StellarWalletsKit connection failed:', err);
        
        // Suppress errors when the user voluntarily closes the modal
        if (err?.message !== 'The user closed the modal.') {
          const errMsg = err instanceof Error ? err.message : String(err?.message || err || 'Connection failed');
          alert(`Wallet Connection Error: ${errMsg}`);
        }
      } finally {
        if (!cancelled) {
          setConnecting(false);
          onClose();
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
    };
  }, [isOpen, network, setAddress, setBalance, setWalletId, onClose]);

  return null; // The official kit handles modal rendering directly in the DOM
}
