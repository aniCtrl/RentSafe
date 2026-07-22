'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { ContractService } from '@/services/contractService';
import { NATIVE_XLM_ID, DEFAULT_ARBITRATOR_ID } from '@/lib/stellar';
import { addKnownEscrowId } from '@/lib/knownEscrows';

const WalletConnectModal = dynamic(() => import('@/components/WalletConnectModal'), { ssr: false });

function CreateAgreementPage() {
  const router = useRouter();
  const { address, network } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(1);

  // Form states
  // Starts blank — must be populated via "Deploy New Escrow Instance" (real on-chain deploy)
  const [targetEscrowId, setTargetEscrowId] = useState('');
  // True once a fresh deploy has confirmed and contractId is captured
  const [deployDone, setDeployDone] = useState(false);
  const [landlord, setLandlord] = useState('');
  const [tenant, setTenant] = useState('');
  const [propAddress, setPropAddress] = useState('');
  const [deposit, setDeposit] = useState('1000');
  const [rent, setRent] = useState('100');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Loading/error states
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleAutoDeploy = async () => {
    if (!address) {
      setModalOpen(true);
      return;
    }
    try {
      setDeploying(true);
      setError(null);
      setDeploySuccess(null);
      const result = await ContractService.deployEscrowInstance(address);
      setTargetEscrowId(result.contractId);
      setDeployDone(true);
      // Pre-register in localStorage so dashboard can find it even before initialize
      addKnownEscrowId(address, result.contractId);
      setDeploySuccess(`✓ New instance deployed: ${result.contractId}`);
      console.log('[Create] Deploy tx hash:', result.txHash);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Escrow instance deployment failed.');
    } finally {
      setDeploying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) {
      setModalOpen(true);
      return;
    }
    if (!targetEscrowId || targetEscrowId.length !== 56) {
      setError('Please enter a valid 56-character Escrow Contract ID to initialize.');
      return;
    }
    if (!landlord || !tenant) {
      setError('Please fill in all participant addresses.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const rawAmt = BigInt(parseFloat(deposit) * 10000000); // convert XLM to stroops

      const hash = await ContractService.initializeEscrow(
        targetEscrowId,
        {
          landlord,
          tenant,
          arbitrator: DEFAULT_ARBITRATOR_ID,
          token: NATIVE_XLM_ID,
          amount: rawAmt
        },
        address
      );

      setTxHash(hash);
      // Persist the initialized escrow so dashboard discovers it immediately
      addKnownEscrowId(address, targetEscrowId);
      // Persist for tenant too so their dashboard also shows it
      if (tenant && tenant !== address) {
        addKnownEscrowId(tenant, targetEscrowId);
      }
      if (landlord && landlord !== address) {
        addKnownEscrowId(landlord, targetEscrowId);
      }
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Escrow initialization transaction failed.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  return (
    <div className="bg-[#f9f9f9] text-[#1a1c1c] font-sans min-h-screen flex flex-col pt-16">
      
      {/* Top Header */}
      <header className="fixed top-0 left-0 w-full z-40 flex justify-between items-center px-6 h-16 bg-[#ffffff] shadow-sm border-b border-[#e2e2e2]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#000000] text-2xl font-bold">real_estate_agent</span>
          <span className="text-base font-bold tracking-tight text-[#000000]">RentSafe</span>
        </div>
        <Link 
          href="/dashboard"
          className="text-[#585f6c] hover:text-[#000000] flex items-center gap-1 text-sm font-semibold transition-colors"
        >
          <span>Cancel</span>
          <span className="material-symbols-outlined text-lg">close</span>
        </Link>
      </header>

      <main className="flex-grow flex items-center justify-center p-6">
        <div className="w-full max-w-[560px] bg-[#ffffff] rounded-[24px] shadow-sm p-8 border border-[#e2e2e2]">
          
          {/* Step Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-lg font-bold text-[#000000]">
                {step === 1 && '1. Participant Addresses'}
                {step === 2 && '2. Property details'}
                {step === 3 && '3. Initialize & Confirm'}
              </h1>
              <span className="text-[10px] font-bold text-[#585f6c] uppercase tracking-wider">Step {step} of 3</span>
            </div>
            
            {/* Progress Dots */}
            <div className="flex gap-2">
              <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-black' : 'bg-[#eeeeee]'}`} />
              <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-black' : 'bg-[#eeeeee]'}`} />
              <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-black' : 'bg-[#eeeeee]'}`} />
            </div>
          </div>

          {error && (
            <div className="bg-[#ffdad6]/40 border border-[#ba1a1a]/20 text-[#ba1a1a] p-4 rounded-xl text-xs mb-6">
              {error}
            </div>
          )}

          {txHash && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs mb-6 font-mono break-all">
              Initialization success! Redirection in progress...<br />
              Hash: {txHash}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* STEP 1: ROLES */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#585f6c] mb-1.5 flex justify-between items-center">
                    <span>Escrow Contract ID (Testnet Address)</span>
                    <button
                      type="button"
                      disabled={deploying}
                      onClick={handleAutoDeploy}
                      className="text-[10px] font-bold text-black underline hover:opacity-85 disabled:opacity-50"
                    >
                      {deploying ? 'Deploying on-chain...' : deployDone ? '↻ Re-deploy New Instance' : 'Deploy New Escrow Instance'}
                    </button>
                  </label>
                  <input 
                    type="text"
                    value={targetEscrowId}
                    onChange={(e) => setTargetEscrowId(e.target.value)}
                    placeholder="Enter the 56-char Escrow contract ID"
                    className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000] font-mono"
                    required
                  />
                  {!deployDone && !deploying && (
                    <p className="text-[10px] text-amber-600 font-semibold mt-1">
                      ⚠ A fresh escrow instance must be deployed before you can continue.
                    </p>
                  )}
                  {deploySuccess && (
                    <p className="text-[10px] text-emerald-700 font-semibold mt-1 break-all">{deploySuccess}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#585f6c] mb-1.5">Landlord Wallet Address</label>
                  <input 
                    type="text"
                    value={landlord}
                    onChange={(e) => setLandlord(e.target.value)}
                    placeholder="G..."
                    className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#585f6c] mb-1.5">Tenant Wallet Address</label>
                  <input 
                    type="text"
                    value={tenant}
                    onChange={(e) => setTenant(e.target.value)}
                    placeholder="G..."
                    className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000]"
                    required
                  />
                </div>
              </div>
            )}

            {/* STEP 2: PROPERTY DETAILS */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#585f6c] mb-1.5">Property Address</label>
                  <input 
                    type="text"
                    value={propAddress}
                    onChange={(e) => setPropAddress(e.target.value)}
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
                      onChange={(e) => setRent(e.target.value)}
                      className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#585f6c] mb-1.5">Deposit Amount (XLM)</label>
                    <input 
                      type="number"
                      value={deposit}
                      onChange={(e) => setDeposit(e.target.value)}
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
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#585f6c] mb-1.5">Lease End Date</label>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-xs p-3 border border-[#c4c7c7] rounded-xl focus:outline-none focus:border-[#000000]"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: CONFIRMATION */}
            {step === 3 && (
              <div className="space-y-4 p-4 bg-[#f3f3f3] rounded-2xl border border-[#e2e2e2] text-xs">
                <h4 className="font-bold text-[#000000] border-b border-[#c4c7c7]/30 pb-2 mb-2">Summary Checklist</h4>
                <div className="space-y-2 text-[#585f6c]">
                  <p><strong className="text-black">Contract ID:</strong> {targetEscrowId}</p>
                  <p><strong className="text-black">Landlord:</strong> {landlord}</p>
                  <p><strong className="text-black">Tenant:</strong> {tenant}</p>
                  <p><strong className="text-black">Property:</strong> {propAddress}</p>
                  <p><strong className="text-black">Monthly Rent:</strong> {rent} XLM</p>
                  <p><strong className="text-black">Deposit Amount:</strong> {deposit} XLM</p>
                  <p><strong className="text-black">Duration:</strong> {startDate} to {endDate}</p>
                </div>
              </div>
            )}

            {/* Actions Footer */}
            <div className="pt-6 border-t border-[#e2e2e2] flex justify-between items-center">
              {step > 1 ? (
                <button 
                  type="button" 
                  onClick={prevStep}
                  className="px-4 py-2 border border-[#c4c7c7] rounded-xl text-xs font-semibold hover:bg-[#f3f3f3]"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <button 
                  type="button" 
                  onClick={nextStep}
                  disabled={step === 1 && !deployDone}
                  title={step === 1 && !deployDone ? 'Deploy a fresh escrow instance first' : undefined}
                  className="bg-black text-white px-5 py-2.5 rounded-xl text-xs font-semibold hover:opacity-90 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Continue</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              ) : (
                <button 
                  type="submit" 
                  disabled={loading}
                  className="bg-black text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading ? 'Initializing...' : 'Confirm & Initialize'}
                  {!loading && <span className="material-symbols-outlined text-sm">done</span>}
                </button>
              )}
            </div>

          </form>

        </div>
      </main>

      <WalletConnectModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />
    </div>
  );
}

export default dynamic(() => Promise.resolve(CreateAgreementPage), { ssr: false });
