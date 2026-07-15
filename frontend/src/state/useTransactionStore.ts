import { create } from 'zustand';

export interface TransactionItem {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'confirmed' | 'failed';
  hash: string | null;
  error: string | null;
  timestamp: number;
  retryAction?: () => Promise<any>;
}

interface TransactionState {
  transactions: TransactionItem[];
  addTransaction: (
    type: string, 
    retryAction?: () => Promise<any>
  ) => string;
  updateStatus: (
    id: string, 
    status: 'pending' | 'processing' | 'confirmed' | 'failed', 
    hash?: string | null, 
    error?: string | null
  ) => void;
  retry: (id: string) => Promise<void>;
  clear: () => void;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],

  addTransaction: (type, retryAction) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newTx: TransactionItem = {
      id,
      type,
      status: 'pending',
      hash: null,
      error: null,
      timestamp: Date.now(),
      retryAction,
    };
    set((state) => ({ transactions: [newTx, ...state.transactions].slice(0, 50) })); // limit to 50 items
    return id;
  },

  updateStatus: (id, status, hash = null, error = null) => {
    set((state) => ({
      transactions: state.transactions.map((tx) =>
        tx.id === id
          ? {
              ...tx,
              status,
              hash: hash !== undefined ? hash : tx.hash,
              error: error !== undefined ? error : tx.error,
            }
          : tx
      ),
    }));
  },

  retry: async (id) => {
    const tx = get().transactions.find((t) => t.id === id);
    if (!tx || !tx.retryAction) return;

    // Reset status to pending
    get().updateStatus(id, 'pending', null, null);

    try {
      get().updateStatus(id, 'processing');
      const res = await tx.retryAction();
      const hash = typeof res === 'string' ? res : (res && res.hash) || null;
      get().updateStatus(id, 'confirmed', hash, null);
    } catch (err: any) {
      console.error('Retry transaction failed:', err);
      get().updateStatus(id, 'failed', null, err.message || 'Retry execution failed');
    }
  },

  clear: () => {
    set({ transactions: [] });
  },
}));
