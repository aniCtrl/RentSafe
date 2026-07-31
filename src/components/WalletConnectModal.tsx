'use client';

import { useEffect, useRef } from 'react';
import { useWalletConnect } from '@/hooks/useWalletConnect';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
  const { connectWallet } = useWalletConnect();
  const lastOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (!lastOpenRef.current) {
        lastOpenRef.current = true;
        connectWallet(onClose);
      }
    } else {
      lastOpenRef.current = false;
    }
  }, [isOpen, connectWallet, onClose]);

  return null;
}
