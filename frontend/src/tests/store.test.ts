import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('@creit.tech/stellar-wallets-kit', () => {
  return {
    StellarWalletsKit: {
      init: vi.fn(),
      setWallet: vi.fn(),
      fetchAddress: vi.fn().mockResolvedValue({ address: 'GDLZFC3SYJ3RYXP77FCV67J3OWNN6TT6SQ34NAAFCCO67B63NHYYC3TS' }),
      disconnect: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock('@creit.tech/stellar-wallets-kit/types', () => {
  return {
    Networks: {
      TESTNET: 'testnet',
      STANDALONE: 'standalone',
    },
  };
});

vi.mock('@creit.tech/stellar-wallets-kit/modules/utils', () => {
  return {
    defaultModules: vi.fn().mockReturnValue([]),
  };
});


import { useWalletStore } from '../state/useWalletStore';
import { useTransactionStore } from '../state/useTransactionStore';

describe('useWalletStore', () => {
  beforeEach(() => {
    useWalletStore.setState({
      address: null,
      walletId: null,
      connected: false,
      balance: '0.00',
      isConnecting: false,
      error: null,
    });
  });

  test('initial state', () => {
    const state = useWalletStore.getState();
    expect(state.connected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.balance).toBe('0.00');
  });

  test('disconnect action resets state', () => {
    useWalletStore.setState({
      connected: true,
      address: 'GDLZFC3SYJ3RYXP77FCV67J3OWNN6TT6SQ34NAAFCCO67B63NHYYC3TS',
      balance: '150.00',
      walletId: 'freighter',
    });

    useWalletStore.getState().disconnect();

    const state = useWalletStore.getState();
    expect(state.connected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.balance).toBe('0.00');
  });
});

describe('useTransactionStore', () => {
  beforeEach(() => {
    useTransactionStore.getState().clear();
  });

  test('initial state is empty list', () => {
    expect(useTransactionStore.getState().transactions).toEqual([]);
  });

  test('addTransaction creates a transaction item', () => {
    const id = useTransactionStore.getState().addTransaction('Propose Claim');
    const txs = useTransactionStore.getState().transactions;
    expect(txs.length).toBe(1);
    expect(txs[0].id).toBe(id);
    expect(txs[0].type).toBe('Propose Claim');
    expect(txs[0].status).toBe('pending');
  });

  test('updateStatus updates transaction details', () => {
    const id = useTransactionStore.getState().addTransaction('Deposit');
    useTransactionStore.getState().updateStatus(id, 'confirmed', 'hash123');

    const txs = useTransactionStore.getState().transactions;
    expect(txs[0].status).toBe('confirmed');
    expect(txs[0].hash).toBe('hash123');
    expect(txs[0].error).toBeNull();
  });
});
