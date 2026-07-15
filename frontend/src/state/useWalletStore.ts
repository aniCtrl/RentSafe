import { create } from 'zustand';
import type { StellarWalletsKit as StellarWalletsKitType } from '@creit.tech/stellar-wallets-kit';
import type { Networks as NetworksType } from '@creit.tech/stellar-wallets-kit/types';
import type { defaultModules as defaultModulesType } from '@creit.tech/stellar-wallets-kit/modules/utils';
import { Horizon } from '@stellar/stellar-sdk';
import contractsConfig from '../contracts-config.json';

interface WalletState {
  address: string | null;
  walletId: string | null;
  network: 'testnet' | 'local';
  balance: string;
  connected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: (walletId: string) => Promise<void>;
  disconnect: () => void;
  setNetwork: (network: 'testnet' | 'local') => void;
  fetchBalance: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  walletId: null,
  network: 'testnet',
  balance: '0.00',
  connected: false,
  isConnecting: false,
  error: null,

  connect: async (walletId: string) => {
    set({ isConnecting: true, error: null });
    try {
      const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
      const { Networks } = await import('@creit.tech/stellar-wallets-kit/types');
      const { defaultModules } = await import('@creit.tech/stellar-wallets-kit/modules/utils');

      StellarWalletsKit.init({
        network: get().network === 'testnet' ? Networks.TESTNET : Networks.STANDALONE,
        modules: defaultModules(),
      });

      // Configure modules based on selected walletId
      StellarWalletsKit.setWallet(walletId);

      const { address } = await StellarWalletsKit.fetchAddress();
      if (!address) {
        throw new Error('Failed to retrieve address from wallet');
      }

      set({
        address,
        walletId,
        connected: true,
        isConnecting: false,
      });

      // Save to localStorage for persistent session
      if (typeof window !== 'undefined') {
        localStorage.setItem('rentsafe_address', address);
        localStorage.setItem('rentsafe_wallet_id', walletId);
      }

      // Fetch wallet balance
      await get().fetchBalance();
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      set({
        error: err.message || 'Failed to connect wallet',
        isConnecting: false,
        connected: false,
      });
    }
  },

  disconnect: () => {
    set({
      address: null,
      walletId: null,
      connected: false,
      balance: '0.00',
    });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rentsafe_address');
      localStorage.removeItem('rentsafe_wallet_id');
      import('@creit.tech/stellar-wallets-kit').then(({ StellarWalletsKit }) => {
        StellarWalletsKit.disconnect().catch(() => {});
      });
    }
  },

  setNetwork: (network: 'testnet' | 'local') => {
    set({ network });
    get().fetchBalance();
  },

  fetchBalance: async () => {
    const { address, network } = get();
    if (!address) return;

    try {
      const config = contractsConfig[network];
      const horizonUrl = network === 'testnet' 
        ? 'https://horizon-testnet.stellar.org' 
        : 'http://localhost:8000';
        
      const server = new Horizon.Server(horizonUrl);
      const accountInfo = await server.loadAccount(address);
      const nativeBalance = accountInfo.balances.find((b) => b.asset_type === 'native');
      
      if (nativeBalance) {
        set({ balance: parseFloat(nativeBalance.balance).toFixed(2) });
      }
    } catch (err) {
      console.warn('Failed to fetch balance from Horizon:', err);
    }
  },
}));
