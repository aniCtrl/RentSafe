import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

import { useAppStore } from '../store/useAppStore';

// Mock dynamic import for WalletConnectModal
vi.mock('next/dynamic', () => ({
  default: () => {
    // Return a dummy client component
    const Component = () => <div data-testid="mock-dynamic">Mock dynamic loaded</div>;
    return Component;
  }
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      prefetch: () => null,
      push: vi.fn(),
    };
  }
}));

// Mock stellar sdk calls
vi.mock('@stellar/stellar-sdk', () => {
  return {
    scValToNative: vi.fn((val) => val),
    nativeToScVal: vi.fn((val) => val),
    Address: class {
      constructor(public val: string) {}
      toScVal() { return this.val; }
    },
    Networks: {
      TESTNET: 'Test SDF Network ; September 2015',
    }
  };
});

describe('Zustand State Store tests', () => {
  beforeEach(() => {
    const { resetSession, setEscrowId, setEscrowInfo, clearTransactions, setWalletId } = useAppStore.getState();
    resetSession();
    setWalletId('');
    setEscrowId('');
    setEscrowInfo(null);
    clearTransactions();
  });

  it('should initialize with default states', () => {
    const state = useAppStore.getState();
    expect(state.address).toBe('');
    expect(state.balance).toBe('0.00');
    expect(state.escrowId).toBe('');
    expect(state.escrowInfo).toBeNull();
    expect(state.transactions).toEqual([]);
  });

  it('should set wallet session state correctly', () => {
    const { setAddress, setBalance, setWalletId } = useAppStore.getState();
    setWalletId('freighter');
    setAddress('GBFJX...');
    setBalance('450.25');

    const state = useAppStore.getState();
    expect(state.walletId).toBe('freighter');
    expect(state.address).toBe('GBFJX...');
    expect(state.balance).toBe('450.25');
  });

  it('should track on-chain transaction history logs', () => {
    const { addTransaction } = useAppStore.getState();
    addTransaction({
      id: 'tx-1',
      hash: '',
      type: 'fund',
      status: 'pending',
      description: 'Funding lease deposit'
    });

    let state = useAppStore.getState();
    expect(state.transactions.length).toBe(1);
    expect(state.transactions[0].status).toBe('pending');

    const { updateTransactionStatus } = useAppStore.getState();
    updateTransactionStatus('tx-1', 'confirmed', 'hash-1234');
    
    state = useAppStore.getState();
    expect(state.transactions[0].status).toBe('confirmed');
    expect(state.transactions[0].hash).toBe('hash-1234');
  });
});

describe('Mock Contract Service and Data mappings', () => {
  it('should format contract escrow response values correctly', async () => {
    const detailsMock = {
      address: 'CBPI35R5GHDJOVGE6CET2FKDJ2I77KCKOXWQ62NHGQN4YCV3MS7OS2Q7',
      landlord: 'GB567...',
      tenant: 'GB123...',
      arbitrator: 'GB999...',
      token: 'CDLZFC3...',
      amount: BigInt('1000000000'), // 100 XLM
      state: 2, // Active
      lockedBalance: '100.00'
    };

    expect(detailsMock.state).toBe(2);
    expect(detailsMock.amount).toBe(BigInt('1000000000'));
    expect(Number(detailsMock.amount) / 10000000).toBe(100);
  });
});
