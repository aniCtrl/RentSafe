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
export type ThemeMode = 'light' | 'dark';

export type NotificationType = 'agreement' | 'dispute' | 'transaction' | 'system';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  agreementId?: string;
  disputeId?: number;
  txHash?: string;
  href?: string;
}

export interface TransactionRecord {
  id: string;
  hash: string;
  type: string;
  status: TxStatus;
  timestamp: number;
  description: string;
  agreementId?: string;
  retryPayload?: {
    contractId: string;
    method: string;
    args: any[];
  };
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
  themeMode: ThemeMode;
  notifications: NotificationRecord[];

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
  setThemeMode: (themeMode: ThemeMode) => void;
  toggleTheme: () => void;
  addNotification: (notification: NotificationRecord) => void;
  createNotification: (notification: Omit<NotificationRecord, 'timestamp' | 'read'> & Partial<Pick<NotificationRecord, 'timestamp' | 'read'>>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const notificationFromTransaction = (tx: TransactionRecord, status: TxStatus, retry = false): NotificationRecord => ({
  id: retry ? `transaction:${tx.id}:retry:${Date.now()}` : `transaction:${tx.id}:${status}`,
  type: 'transaction',
  severity: status === 'confirmed' ? 'success' : status === 'failed' ? 'error' : 'info',
  title: status === 'confirmed' ? 'Transaction confirmed' : status === 'failed' ? 'Transaction failed' : status === 'pending' ? 'Transaction queued' : retry ? 'Transaction retrying' : 'Transaction processing',
  message: status === 'confirmed' ? `${tx.description} was confirmed on Stellar.` : status === 'failed' ? `${tx.description} failed. You can retry it from Transaction Center.` : retry ? `Retrying ${tx.description}.` : tx.description,
  timestamp: Date.now(),
  read: false,
  agreementId: tx.agreementId,
  txHash: tx.hash || undefined,
  href: tx.agreementId ? `/inspect-escrow/${tx.agreementId}` : '/transaction-center',
});

const appendNotification = (notifications: NotificationRecord[], notification: NotificationRecord) => {
  if (notifications.some((item) => item.id === notification.id)) return notifications;
  return [notification, ...notifications].slice(0, 100);
};

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
      themeMode: 'light',
      notifications: [],

      setAddress: (address) => set((state) => ({
        address,
        ...(state.address && state.address.toLowerCase() !== address.toLowerCase()
          ? { notifications: [], transactions: [] }
          : {}),
      })),
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
          notifications: [],
        }),

      addTransaction: (tx) =>
        set((state) => {
          const transaction = { ...tx, timestamp: Date.now() };
          return {
            transactions: [transaction, ...state.transactions.slice(0, 49)],
            notifications: appendNotification(state.notifications, notificationFromTransaction(transaction, tx.status)),
          };
        }),

      updateTransactionStatus: (id, status, hash, patch) =>
        set((state) => {
          const transaction = state.transactions.find((tx) => tx.id === id);
          if (!transaction) return state;
          const updated = { ...transaction, status, ...(hash ? { hash } : {}), ...(patch ?? {}) };
          return {
            transactions: state.transactions.map((tx) => (tx.id === id ? updated : tx)),
            notifications: appendNotification(
              state.notifications,
              notificationFromTransaction(updated, status, status === 'processing' && transaction.status === 'failed'),
            ),
          };
        }),

      clearTransactions: (agreementId) =>
        set((state) => ({
          transactions: agreementId
            ? state.transactions.filter((tx) => tx.agreementId !== agreementId)
            : [],
        })),

      setThemeMode: (themeMode) => set({ themeMode }),
      toggleTheme: () => set((state) => ({ themeMode: state.themeMode === 'light' ? 'dark' : 'light' })),
      addNotification: (notification) => set((state) => ({
        notifications: appendNotification(state.notifications, notification),
      })),
      createNotification: (notification) => set((state) => ({
        notifications: appendNotification(state.notifications, {
          ...notification,
          timestamp: notification.timestamp ?? Date.now(),
          read: notification.read ?? false,
        }),
      })),
      markNotificationRead: (id) => set((state) => ({
        notifications: state.notifications.map((notification) => notification.id === id ? { ...notification, read: true } : notification),
      })),
      markAllNotificationsRead: () => set((state) => ({
        notifications: state.notifications.map((notification) => ({ ...notification, read: true })),
      })),
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((notification) => notification.id !== id),
      })),
      clearNotifications: () => set({ notifications: [] }),
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
        themeMode: state.themeMode,
        notifications: state.notifications,
      }),
    },
  ),
);
