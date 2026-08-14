'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useCreateAgreement } from '@/hooks/useCreateAgreement';
import { formatAgreementId } from '@/lib/rentsafe';

const WalletConnectModal = dynamic(() => import('@/components/WalletConnectModal'), { ssr: false });

export default function CreateAgreementView() {
  const [modalOpen, setModalOpen] = useState(false);
  const {
    step,
    setStep,
    landlord,
    setLandlord,
    tenant,
    setTenant,
    propertyDetails,
    setPropertyDetails,
    deposit,
    setDeposit,
    rent,
    setRent,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    loading,
    error,
    setError,
    txHash,
    createdAgreementId,
    sharedContractId,
    handleSubmit,
  } = useCreateAgreement();

  const continueToNextStep = () => {
    if (step === 1 && (!landlord.trim() || !tenant.trim())) {
      setError('Enter both the landlord and tenant wallet addresses to continue.');
      return;
    }
    if (step === 2 && (!propertyDetails.trim() || !rent || !deposit || !startDate || !endDate)) {
      setError('Complete the property, amount, and lease date fields to continue.');
      return;
    }
    setError(null);
    setStep((current) => current + 1);
  };

  return (
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
          <div className="flex gap-2" aria-label={`Create agreement progress: step ${step} of 3`} role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step}>
            <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-black' : 'bg-[#eeeeee]'}`} />
            <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-black' : 'bg-[#eeeeee]'}`} />
            <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 3 ? 'bg-black' : 'bg-[#eeeeee]'}`} />
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

        <form onSubmit={(event) => handleSubmit(event, () => setModalOpen(true))} className="space-y-6">
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
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
            <div className="space-y-4 animate-fadeIn">
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
            <div className="space-y-4 p-4 bg-[#f3f3f3] rounded-2xl border border-[#e2e2e2] text-xs animate-fadeIn">
              <h4 className="font-bold text-[#000000] border-b border-[#c4c7c7]/30 pb-2 mb-2">Summary Checklist</h4>
              <div className="space-y-2 text-[#585f6c]">
                <p className="break-all"><strong className="text-black">Shared Contract:</strong> <span className="font-mono text-[10px] block mt-0.5 text-black">{sharedContractId}</span></p>
                <p className="break-all"><strong className="text-black">Landlord:</strong> <span className="font-mono text-[10px] block mt-0.5 text-black">{landlord}</span></p>
                <p className="break-all"><strong className="text-black">Tenant:</strong> <span className="font-mono text-[10px] block mt-0.5 text-black">{tenant}</span></p>
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
              <button type="button" onClick={continueToNextStep} className="bg-black text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 transition-opacity">
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

      <WalletConnectModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
