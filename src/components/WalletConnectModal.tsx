'use client';

import React, { useEffect } from 'react';
import { useWalletConnect } from '@/hooks/useWalletConnect';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
  const { connecting, connectWallet } = useWalletConnect();

  useEffect(() => {
    if (!isOpen || connecting) return;
    connectWallet(onClose);
  }, [isOpen, connecting, connectWallet, onClose]);

  return null;
}
