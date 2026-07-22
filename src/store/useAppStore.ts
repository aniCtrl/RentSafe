import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AgreementRecord } from '@/lib/rentsafe';

const memoryStorage = new Map<string, string>();

const safeStorage = {
  getItem: (name: string) => {
    const storage = typeof window !== 'undefined' ? window.localStorage : undefined;
    if (storage && typeof storage.getItem === 'function') {
      return storage.getItem(name);
    }
    return memoryStorage.get(name) ?? null;
  },
  setItem: (name: string, value: string) => {
    const storage = typeof window !== 'undefined' ? window.localStorage : undefined;
    if (storage && typeof storage.setItem === 'function') {
      storage.setItem(name, value);
      return;
    }
    memoryStorage.set(name, value);
  },
  removeItem: (name: string) => {
    const storage = typeof window !== 'undefined' ? window.localStorage : undefined;
    if (storage && typeof storage.removeItem === 'function') {
      storage.removeItem(name);
      return;
    }
    memoryStorage.delete(name);
  },
};

export type TxStatus = 'pending' | 'processing' | 'confirmed' | 'failed';

export interface TransactionRecord {
  id: string;
  hash: string;
  type: string;
  status: TxStatus;
  timestamp: number;
  description: string;
  agreementId?: string;
}

export type EscrowInfo = AgreementRecord;

interface AppState {
  address: string;
  balance: string;
  network: 'testnet' | 'mainnet';
  walletId: string;
  escrowId: string;
  escrowInfo: EscrowInfo | null;
  loadingEscrow: boolean;
  transactions: TransactionRecord[];

  setAddress: (address: string) => void;
  setBalance: (balance: string) => void;
  setNetwork: (network: 'testnet' | 'mainnet') => void;
  setWalletId: (walletId: string) => void;
  setEscrowId: (escrowId: string) => void;
  setEscrowInfo: (info: EscrowInfo | null) => void;
  setLoadingEscrow: (loading: boolean) => void;
  resetSession: () => void;

  addTransaction: (tx: Omit<TransactionRecord, 'timestamp'>) => void;
  updateTransactionStatus: (id: string, status: TxStatus, hash?: string, patch?: Partial<TransactionRecord>) => void;
  clearTransactions: (agreementId?: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      address: '',
      balance: '0.00',
      network: 'testnet',
      walletId: '',
      escrowId: '',
      escrowInfo: null,
      loadingEscrow: false,
      transactions: [],

      setAddress: (address) => set({ address }),
      setBalance: (balance) => set({ balance }),
      setNetwork: (network) => set({ network }),
      setWalletId: (walletId) => set({ walletId }),
      setEscrowId: (escrowId) => set({ escrowId }),
      setEscrowInfo: (escrowInfo) => set({ escrowInfo }),
      setLoadingEscrow: (loadingEscrow) => set({ loadingEscrow }),
      resetSession: () =>
        set({
          address: '',
          balance: '0.00',
          walletId: '',
          escrowId: '',
          escrowInfo: null,
          transactions: [],
        }),

      addTransaction: (tx) =>
        set((state) => ({
          transactions: [{ ...tx, timestamp: Date.now() }, ...state.transactions.slice(0, 49)],
        })),

      updateTransactionStatus: (id, status, hash, patch) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id ? { ...tx, status, ...(hash ? { hash } : {}), ...(patch ?? {}) } : tx,
          ),
        })),

      clearTransactions: (agreementId) =>
        set((state) => ({
          transactions: agreementId
            ? state.transactions.filter((tx) => tx.agreementId !== agreementId)
            : [],
        })),
    }),
    {
      name: 'rentsafe-app-store',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        address: state.address,
        balance: state.balance,
        network: state.network,
        walletId: state.walletId,
        escrowId: state.escrowId,
      }),
    },
  ),
);
