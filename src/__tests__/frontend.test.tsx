import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardOverview from '../components/dashboard/DashboardOverview';
import CreatePage from '../app/create/page';
import AppShell from '../components/app/AppShell';
import { useAppStore } from '../store/useAppStore';
import { useUserAgreements, useDashboardMetrics } from '../hooks/useChainQueries';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      prefetch: () => null,
      push: vi.fn(),
    };
  },
  usePathname() {
    return '/dashboard';
  }
}));

// Mock hooks
vi.mock('@/hooks/useChainQueries', () => ({
  useUserAgreements: vi.fn(),
  useDashboardMetrics: vi.fn(),
}));

// Mock Stellar SDK & Wallet Kit
vi.mock('@stellar/stellar-sdk', () => {
  return {
    scValToNative: vi.fn((val) => val),
    nativeToScVal: vi.fn((val) => val),
    Address: class {
      constructor(public val: string) {}
      toScVal() { return this.val; }
    },
    Contract: class {
      constructor(public id: string) {}
      call() { return {}; }
    },
    Account: class {
      constructor(public id: string, public seq: string) {}
    },
    TransactionBuilder: class {
      constructor() {}
      static fromXDR() { return { toXDR: () => 'mock-xdr' }; }
      addOperation() { return this; }
      setTimeout() { return this; }
      build() { return { toXDR: () => 'mock-xdr' }; }
    },
    xdr: {
      TransactionMeta: {
        fromXDR: vi.fn(),
      }
    },
    Networks: {
      TESTNET: 'Test SDF Network ; September 2015',
      PUBLIC: 'Public Global Stellar Network ; September 2015',
    },
    rpc: {
      Server: class {
        constructor() {}
        getAccount() { return Promise.resolve({}); }
        prepareTransaction(tx: any) { return Promise.resolve(tx); }
        sendTransaction() { return Promise.resolve({ status: 'PENDING', hash: 'tx-hash' }); }
        getTransaction() { return Promise.resolve({ status: 'SUCCESS' }); }
        simulateTransaction() { return Promise.resolve({ result: { retval: 'sim-val' } }); }
      }
    }
  };
});

const mockAuthModal = vi.fn(async () => ({ address: 'GB1234567890' }));
const mockDisconnect = vi.fn(async () => {});
const mockSetNetwork = vi.fn();
const mockSetWallet = vi.fn();
const mockInit = vi.fn();

vi.mock('@creit.tech/stellar-wallets-kit/sdk', () => ({
  StellarWalletsKit: {
    init: (...args: any[]) => mockInit(...args),
    setNetwork: (...args: any[]) => mockSetNetwork(...args),
    setWallet: (...args: any[]) => mockSetWallet(...args),
    authModal: () => mockAuthModal(),
    disconnect: () => mockDisconnect(),
    selectedModule: { productId: 'freighter' },
  }
}));

vi.mock('@creit.tech/stellar-wallets-kit/modules/utils', () => ({
  defaultModules: () => [],
}));

vi.mock('@creit.tech/stellar-wallets-kit/types', () => ({
  Networks: { TESTNET: 'testnet', PUBLIC: 'public' },
}));

describe('Frontend UI Component Tests', () => {
  beforeEach(() => {
    const { resetSession } = useAppStore.getState();
    resetSession();
    vi.clearAllMocks();
  });

  it('DashboardOverview: renders Connect Wallet prompt when user is not connected', () => {
    // Force disconnected state
    useAppStore.setState({ address: '', walletId: '' });
    (useUserAgreements as any).mockReturnValue({ data: [], isLoading: false });
    (useDashboardMetrics as any).mockReturnValue({ data: null, isLoading: false });

    render(<DashboardOverview />);

    // Screen should render the connect prompt with heading and instructions
    expect(screen.getByRole('heading', { name: 'Connect Wallet' })).toBeInTheDocument();
    expect(screen.getByText('Please connect your Stellar wallet to view your rental agreements.')).toBeInTheDocument();
  });

  it('DashboardOverview: renders No Agreements state when connected but agreements list is empty', () => {
    // Force connected state with no agreements
    useAppStore.setState({ address: 'GB1234567890', walletId: 'freighter' });
    (useUserAgreements as any).mockReturnValue({ data: [], isLoading: false });
    (useDashboardMetrics as any).mockReturnValue({ data: { tvl: '0.00', activeCount: 0, pendingCount: '0.00' }, isLoading: false });

    render(<DashboardOverview />);

    expect(screen.getByText('No Agreements Found')).toBeInTheDocument();
    expect(screen.getByText('You do not have any agreements registered in the shared escrow contract yet.')).toBeInTheDocument();
    expect(screen.getByText('Create New Agreement')).toBeInTheDocument();
  });

  it('Create Agreement Form: triggers validation errors on parameter mismatch', async () => {
    // Force connected state
    useAppStore.setState({ address: 'GB_LANDLORD_123', walletId: 'freighter' });

    render(<CreatePage />);

    // Step 1: Fill landlord and tenant addresses and continue
    const inputs = screen.getAllByPlaceholderText('G...');
    fireEvent.change(inputs[0], { target: { value: 'GB_OTHER_LANDLORD' } });
    fireEvent.change(inputs[1], { target: { value: 'GB_TENANT_555' } });

    const continueBtn1 = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(continueBtn1);

    // Step 2: Fill property and date details and continue
    const propertyInput = screen.getByPlaceholderText('e.g., 123 Main St, Apt 4B');
    fireEvent.change(propertyInput, { target: { value: '123 Main Street' } });

    const allInputs = document.querySelectorAll('input');
    const startDateInput = Array.from(allInputs).find(i => i.type === 'date');
    const endDateInput = Array.from(allInputs).find(i => i.type === 'date' && i !== startDateInput);

    if (startDateInput) fireEvent.change(startDateInput, { target: { value: '2026-08-01' } });
    if (endDateInput) fireEvent.change(endDateInput, { target: { value: '2027-08-01' } });

    const continueBtn2 = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(continueBtn2);

    // Step 3: Confirm & Create
    const createBtn = screen.getByRole('button', { name: /Create Agreement/i });
    fireEvent.click(createBtn);

    // Connected address is GB_LANDLORD_123, but landlord input is GB_OTHER_LANDLORD
    expect(screen.getByText('The connected wallet must match the landlord address to create an agreement on-chain.')).toBeInTheDocument();
  });

  it('AppShell: triggers wallet connect modal when connect button is clicked', async () => {
    useAppStore.setState({ address: '', walletId: '' });

    render(
      <AppShell title="Test Page">
        <div>Content</div>
      </AppShell>
    );

    // Get connect button and click it
    const connectBtn = screen.getByRole('button', { name: 'Connect Wallet' });
    fireEvent.click(connectBtn);

    // WalletConnectModal is rendered as a headless component calling authModal
    await waitFor(() => {
      expect(mockAuthModal).toHaveBeenCalled();
    });
  });
});
