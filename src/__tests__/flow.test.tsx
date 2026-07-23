import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CreatePage from '../app/create/page';
import { useAppStore } from '../store/useAppStore';
import { ContractService } from '../services/contractService';

// Mock router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      prefetch: () => null,
      push: mockPush,
    };
  },
  usePathname() {
    return '/create';
  }
}));

// Mock Contract Service call
vi.mock('@/services/contractService', () => ({
  ContractService: {
    createAgreement: vi.fn(),
    getAgreementIds: vi.fn(),
  }
}));

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('Frontend End-to-End Flow Integration', () => {
  beforeEach(() => {
    const { resetSession } = useAppStore.getState();
    resetSession();
    vi.clearAllMocks();
  });

  it('should successfully fill out the creation form, call ContractService, and navigate', async () => {
    // 1. Setup session state for landlord
    useAppStore.setState({ address: 'GB_LANDLORD_123', walletId: 'freighter' });

    // Mock contract return value
    (ContractService.createAgreement as any).mockResolvedValue({
      txHash: 'hash-abc-123',
      agreementId: 42,
    });

    render(
      <QueryClientProvider client={testQueryClient}>
        <CreatePage />
      </QueryClientProvider>
    );

    // 2. Step 1: Add Landlord & Tenant address
    const inputs = screen.getAllByPlaceholderText('G...');
    fireEvent.change(inputs[0], { target: { value: 'GB_LANDLORD_123' } });
    fireEvent.change(inputs[1], { target: { value: 'GB_TENANT_456' } });

    const continueBtn1 = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(continueBtn1);

    // 3. Step 2: Property & Lease Dates & Rent/Deposit
    const propertyInput = screen.getByPlaceholderText('e.g., 123 Main St, Apt 4B');
    fireEvent.change(propertyInput, { target: { value: '99 Baker Street' } });

    const depositInput = screen.getByDisplayValue('1000');
    fireEvent.change(depositInput, { target: { value: '1500' } });

    const rentInput = screen.getByDisplayValue('100');
    fireEvent.change(rentInput, { target: { value: '150' } });

    const allInputs = document.querySelectorAll('input');
    const startDateInput = Array.from(allInputs).find(i => i.type === 'date');
    const endDateInput = Array.from(allInputs).find(i => i.type === 'date' && i !== startDateInput);

    if (startDateInput) fireEvent.change(startDateInput, { target: { value: '2026-08-01' } });
    if (endDateInput) fireEvent.change(endDateInput, { target: { value: '2027-08-01' } });

    const continueBtn2 = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(continueBtn2);

    // 4. Step 3: Confirm & Submit
    const createBtn = screen.getByRole('button', { name: /Create Agreement/i });
    fireEvent.click(createBtn);

    // Verify service was called with proper Stroops math (1500 XLM = 15,000,000,000 Stroops)
    await waitFor(() => {
      expect(ContractService.createAgreement).toHaveBeenCalledWith({
        landlord: 'GB_LANDLORD_123',
        tenant: 'GB_TENANT_456',
        propertyDetails: '99 Baker Street',
        depositAmount: 15000000000n,
        rentAmount: 1500000000n,
        leaseStart: expect.any(Number),
        leaseEnd: expect.any(Number),
      }, 'GB_LANDLORD_123');
    });

    // Check store state: Transaction added
    const tx = useAppStore.getState().transactions[0];
    expect(tx).toBeDefined();
    expect(tx.status).toBe('confirmed');
    expect(tx.hash).toBe('hash-abc-123');

    // Assert navigation to inspect the newly created agreement
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/inspect-escrow/42');
    }, { timeout: 3500 });
  });
});
