'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/app/AppShell';
import { useAppStore } from '@/store/useAppStore';
import { ContractService } from '@/services/contractService';
import { AgreementChainService } from '@/services/chain/agreementService';
import { formatAgreementId } from '@/lib/rentsafe';

const WalletConnectModal = dynamic(() => import('@/components/WalletConnectModal'), { ssr: false });

const toUnixSeconds = (date: string, endOfDay = false) => {
  if (!date) return 0;
  const suffix = endOfDay ? 'T23:59:59Z' : 'T00:00:00Z';
  return Math.floor(new Date(`${date}${suffix}`).getTime() / 1000);
};

export default function CreateAgreementPage() {
  const router = useRouter();
  const { address, setEscrowId, addTransaction, updateTransactionStatus } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [landlord, setLandlord] = useState('');
  const [tenant, setTenant] = useState('');
  const [propertyDetails, setPropertyDetails] = useState('');
  const [deposit, setDeposit] = useState('1000');
  const [rent, setRent] = useState('100');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [createdAgreementId, setCreatedAgreementId] = useState<number | null>(null);

  const sharedContractId = useMemo(() => AgreementChainService.getSharedContractId(), []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!address) {
      setModalOpen(true);
      return;
    }

    if (!landlord || !tenant || !propertyDetails || !deposit || !rent || !startDate || !endDate) {
      setError('Please complete every required field before submitting.');
      return;
    }

    if (address.toLowerCase() !== landlord.toLowerCase()) {
      setError('The connected wallet must match the landlord address to create an agreement on-chain.');
      return;
    }

    const leaseStart = toUnixSeconds(startDate);
    const leaseEnd = toUnixSeconds(endDate, true);
    if (!leaseStart || !leaseEnd || leaseStart >= leaseEnd) {
      setError('Lease start must be earlier than lease end.');
      return;
    }

    const txId = `create-agreement-${Date.now()}`;

    try {
      setLoading(true);
      setError(null);
      addTransaction({
        id: txId,
        hash: '',
        type: 'create_agreement',
        status: 'processing',
        description: `Creating agreement for ${propertyDetails}`,
      });

      const result = await ContractService.createAgreement(
        {
          landlord,
          tenant,
          propertyDetails,
          depositAmount: BigInt(Math.round(parseFloat(deposit) * 10000000)),
          rentAmount: BigInt(Math.round(parseFloat(rent) * 10000000)),
          leaseStart,
          leaseEnd,
        },
        address,
      );

      // extractReturnValue may return 0 if the Soroban SDK metadata parse fails.
      // Fall back to fetching the latest agreement IDs from the chain.
      let resolvedId = result.agreementId;
      if (!resolvedId || resolvedId <= 0) {
        try {
          const ids = await ContractService.getAgreementIds();
          if (ids.length > 0) {
            resolvedId = Math.max(...ids);
          }
        } catch (fallbackError) {
          console.warn('Could not resolve agreement ID via fallback:', fallbackError);
        }
      }

      setTxHash(result.txHash);
      setCreatedAgreementId(resolvedId);
      setEscrowId(String(resolvedId));
      updateTransactionStatus(txId, 'confirmed', result.txHash, { agreementId: String(resolvedId) });

      if (resolvedId > 0) {
        window.setTimeout(() => {
          router.push(`/inspect-escrow/${resolvedId}`);
        }, 2500);
      }
    } catch (submitError) {
      console.error(submitError);
      updateTransactionStatus(txId, 'failed');
      const message = submitError instanceof Error ? submitError.message : 'Agreement creation transaction failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Create Rental Agreement">
      <div className="flex justify-center">
        <div className="w-full max-w-[560px] bg-[#ffffff] rounded-[24px] shadow-sm p-8 border border-[#e2e2e2]">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4 gap-3">
              <h1 className="text-lg font-bold text-[#000000]">
                {step === 1 && '1. Participant Addresses'}
                {step === 2 && '2. Property Details'}
                {step === 3 && '3. Confirm & Create'}
              </h1>
              <span className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider">Step {step} of 3</span>
            </div>
            <div className="flex gap-2">
              <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-black' : 'bg-[#eeeeee]'}`} />
              <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-black' : 'bg-[#eeeeee]'}`} />
              <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-black' : 'bg-[#eeeeee]'}`} />
            </div>
          </div>

          <div className="bg-[#f3f3f3] border border-[#e2e2e2] rounded-2xl p-4 text-xs text-[#585f6c] mb-6">
            This form creates an agreement directly on the single shared escrow contract configured for RentSafe.
            <div className="font-mono text-[10px] text-black mt-2 break-all">{sharedContractId}</div>
          </div>

          {error && <div className="bg-[#ffdad6]/40 border border-[#ba1a1a]/20 text-[#ba1a1a] p-4 rounded-xl text-xs mb-6">{error}</div>}

          {txHash && createdAgreementId !== null && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs mb-6 space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">check_circle</span>
                Agreement Created!
              </p>
              <p>
                <span className="font-semibold">ID:</span>{' '}
                <span className="font-mono">
                  {createdAgreementId > 0
                    ? formatAgreementId(createdAgreementId)
                    : 'Resolving...'}
                </span>
              </p>
              <p className="font-mono break-all text-[10px]">Hash: {txHash}</p>
              {createdAgreementId > 0 && (
                <a
                  href={`/inspect-escrow/${createdAgreementId}`}
                  className="inline-flex items-center gap-1 font-bold underline text-emerald-900 mt-1"
                >
                  View Agreement
                  <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                </a>
              )}
              <p className="text-[10px] text-emerald-700">Redirecting automatically...</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#585f6c] mb-1.5">Landlord Wallet Address</label>
                  <input
                    type="text"
                    value={landlord}
                    onChange={(event) => setLandlord(event.target.value)}
                    placeholder="G..."
                    className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000]"
                    required
                  />
                  <p className="text-[10px] text-[#747878] mt-1">Must match the connected wallet address when submitting.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#585f6c] mb-1.5">Tenant Wallet Address</label>
                  <input
                    type="text"
                    value={tenant}
                    onChange={(event) => setTenant(event.target.value)}
                    placeholder="G..."
                    className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000]"
                    required
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#585f6c] mb-1.5">Property</label>
                  <input
                    type="text"
                    value={propertyDetails}
                    onChange={(event) => setPropertyDetails(event.target.value)}
                    placeholder="e.g., 123 Main St, Apt 4B"
                    className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000]"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#585f6c] mb-1.5">Monthly Rent (XLM)</label>
                    <input
                      type="number"
                      value={rent}
                      onChange={(event) => setRent(event.target.value)}
                      className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#585f6c] mb-1.5">Deposit Amount (XLM)</label>
                    <input
                      type="number"
                      value={deposit}
                      onChange={(event) => setDeposit(event.target.value)}
                      className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000]"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#585f6c] mb-1.5">Lease Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#585f6c] mb-1.5">Lease End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000]"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 p-4 bg-[#f3f3f3] rounded-2xl border border-[#e2e2e2] text-xs">
                <h4 className="font-bold text-[#000000] border-b border-[#c4c7c7]/30 pb-2 mb-2">Summary Checklist</h4>
                <div className="space-y-2 text-[#585f6c]">
                  <p><strong className="text-black">Shared Contract:</strong> {sharedContractId}</p>
                  <p><strong className="text-black">Landlord:</strong> {landlord}</p>
                  <p><strong className="text-black">Tenant:</strong> {tenant}</p>
                  <p><strong className="text-black">Property:</strong> {propertyDetails}</p>
                  <p><strong className="text-black">Monthly Rent:</strong> {rent} XLM</p>
                  <p><strong className="text-black">Deposit Amount:</strong> {deposit} XLM</p>
                  <p><strong className="text-black">Duration:</strong> {startDate} to {endDate}</p>
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-[#e2e2e2] flex justify-between items-center">
              {step > 1 ? (
                <button type="button" onClick={() => setStep((current) => current - 1)} className="px-4 py-2 border border-[#c4c7c7] rounded-xl text-xs font-semibold hover:bg-[#f3f3f3]">
                  Back
                </button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <button type="button" onClick={() => setStep((current) => current + 1)} className="bg-black text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 transition-opacity">
                  Continue
                </button>
              ) : (
                <button type="submit" disabled={loading} className="bg-black text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {loading ? 'Submitting...' : 'Create Agreement'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <WalletConnectModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </AppShell>
  );
}
