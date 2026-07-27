'use client';

/**
 * RentSafePortal Component
 * 
 * Presentation Layout Component for the RentSafe Dashboard.
 * Business logic has been extracted to useEscrowContract hook.
 * @see file:///Users/bahnishikhasingha/Documents/RentSafe/src/hooks/useEscrowContract.ts
 */

import React from 'react';
import { useEscrowContract } from '../hooks/useEscrowContract';
import { initializeWalletsKit, NATIVE_XLM_ID } from '../lib/stellar';
import { 
  Plus, 
  Loader2, 
  Check, 
  AlertTriangle, 
  ExternalLink 
} from 'lucide-react';

import Masthead from './Masthead';
import StatTicker from './StatTicker';
import EscrowDetails from './EscrowDetails';
import ConsoleActions from './ConsoleActions';
import ArbitrationControl from './ArbitrationControl';
import QuickInfo from './QuickInfo';
import TutorialSection from './TutorialSection';
import EditorialFooter from './EditorialFooter';

const DEFAULT_ESCROW_ID = 'CBPI35R5GHDJOVGE6CET2FKDJ2I77KCKOXWQ62NHGQN4YCV3MS7OS2Q7';
const DEFAULT_DISPUTE_ID = 'CCTC5ZQPSXD6DVXNRTJBTJC32PTPAGAWQEBPVKJHQAI5UZVS54TF4BSX';

const STATE_NAMES = [
  'Created',
  'Funded',
  'Active',
  'SettlementRequested',
  'Disputed',
  'Resolved',
  'Closed'
];

export default function RentSafePortal() {
  const {
    address,
    balance,
    connecting,
    escrowId,
    setEscrowId,
    escrowInfo,
    loadingEscrow,
    escrowBalance,
    newLandlord,
    setNewLandlord,
    newTenant,
    setNewTenant,
    newArbitrator,
    setNewArbitrator,
    newAmount,
    setNewAmount,
    linkDisputeId,
    setLinkDisputeId,
    actionLoading,
    actionTx,
    actionError,
    landlordShare,
    setLandlordShare,
    tenantShare,
    setTenantShare,
    evidenceHash,
    setEvidenceHash,
    tickerDate,
    connectWallet,
    fetchEscrowInfo,
    getUserRole,
    executeAction,
    initializeNewAgreement,
    setDisputeContractOnEscrow,
    resolveArbitratorDispute,
  } = useEscrowContract();

  return (
    <div className="min-h-screen bg-paper-bg text-ink-black flex flex-col antialiased">
      {/* 1. Header Masthead Component */}
      <Masthead
        address={address}
        balance={balance}
        connecting={connecting}
        connectWallet={connectWallet}
        userRole={getUserRole()}
        tickerDate={tickerDate}
      />

      {/* 2. Scrolling Marquee Ticker Component */}
      <StatTicker
        defaultEscrowId={DEFAULT_ESCROW_ID}
        defaultDisputeId={DEFAULT_DISPUTE_ID}
      />

      {/* 3. Main Dashboard Layout */}
      <main className="max-w-screen-xl w-full mx-auto px-4 md:px-8 py-12 flex-grow">
        
        {/* Error Notification banner */}
        {actionError && (
          <div className="bg-[#FFF0F0] border-2 border-[#CC0000] text-ink-black p-4 mb-8 flex items-start gap-3 sharp-corners">
            <AlertTriangle className="h-5 w-5 text-[#CC0000] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-serif font-bold text-lg text-[#CC0000]">Execution Incident</h4>
              <p className="font-mono text-xs mt-1">{actionError}</p>
            </div>
          </div>
        )}

        {/* Transaction Success banner */}
        {actionTx && (
          <div className="bg-[#F0FFF0] border-2 border-green-700 text-ink-black p-4 mb-8 flex items-start gap-3 sharp-corners">
            <Check className="h-5 w-5 text-green-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-serif font-bold text-lg text-green-700">Transaction Confirmed</h4>
              <p className="font-mono text-xs mt-1">Transaction recorded successfully on-chain.</p>
              <a 
                href={`https://stellar.expert/explorer/testnet/tx/${actionTx}`} 
                target="_blank" 
                rel="noreferrer"
                className="font-mono text-[10px] uppercase text-green-700 hover:text-ink-black inline-flex items-center gap-1 mt-2 underline"
              >
                View on Stellar Expert <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {/* Main Grid Splits (Asymmetric 8-col / 4-col layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Escrow Info, Visualizer & Desk Actions (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            
            {/* Escrow Details Inspector & State Visualizer */}
            <EscrowDetails
              escrowId={escrowId}
              setEscrowId={setEscrowId}
              loadingEscrow={loadingEscrow}
              fetchEscrowInfo={fetchEscrowInfo}
              escrowInfo={escrowInfo}
              escrowBalance={escrowBalance}
              nativeXlmId={NATIVE_XLM_ID}
              stateNames={STATE_NAMES}
            />

            {/* Actions panel */}
            {escrowInfo && (
              <ConsoleActions
                escrowInfo={escrowInfo}
                address={address}
                actionLoading={actionLoading}
                executeAction={executeAction}
                landlordShare={landlordShare}
                setLandlordShare={setLandlordShare}
                tenantShare={tenantShare}
                setTenantShare={setTenantShare}
                evidenceHash={evidenceHash}
                setEvidenceHash={setEvidenceHash}
              />
            )}
          </div>

          {/* RIGHT COLUMN: Builders, Arbitrators & Keys (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-8">
            
            {/* Section 1: Agreement Initializer */}
            <div className="border border-ink-black bg-white p-6 flex flex-col gap-4 sharp-corners">
              <div className="border-b border-ink-black pb-2">
                <h3 className="font-serif text-xl font-black">Initialize Escrow</h3>
                <p className="font-mono text-[10px] text-neutral-500 mt-1">Configure roles inside a newly deployed contract instance.</p>
              </div>

              <div className="flex flex-col gap-3 font-mono text-xs">
                <div>
                  <label className="text-neutral-500 uppercase tracking-widest block font-bold mb-1">Landlord Public Key</label>
                  <input 
                    type="text" 
                    value={newLandlord}
                    onChange={(e) => setNewLandlord(e.target.value)}
                    placeholder="G..."
                    className="w-full border-b border-ink-black bg-transparent py-1 text-xs focus-visible:outline-none sharp-corners"
                  />
                </div>
                <div>
                  <label className="text-neutral-500 uppercase tracking-widest block font-bold mb-1">Tenant Public Key</label>
                  <input 
                    type="text" 
                    value={newTenant}
                    onChange={(e) => setNewTenant(e.target.value)}
                    placeholder="G..."
                    className="w-full border-b border-ink-black bg-transparent py-1 text-xs focus-visible:outline-none sharp-corners"
                  />
                </div>
                <div>
                  <label className="text-neutral-500 uppercase tracking-widest block font-bold mb-1">Arbitrator Public Key</label>
                  <input 
                    type="text" 
                    value={newArbitrator}
                    onChange={(e) => setNewArbitrator(e.target.value)}
                    placeholder="G..."
                    className="w-full border-b border-ink-black bg-transparent py-1 text-xs focus-visible:outline-none sharp-corners"
                  />
                </div>
                <div>
                  <label className="text-neutral-500 uppercase tracking-widest block font-bold mb-1">Deposit Size (XLM)</label>
                  <input 
                    type="number" 
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full border-b border-ink-black bg-transparent py-1 text-xs focus-visible:outline-none sharp-corners"
                  />
                </div>
                <button
                  disabled={actionLoading !== null}
                  onClick={initializeNewAgreement}
                  className="w-full bg-ink-black text-white hover:bg-neutral-800 text-xs font-mono uppercase tracking-widest font-bold py-3 mt-2 sharp-corners disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
                >
                  {actionLoading === 'initialize' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Initialize Agreement'}
                </button>
              </div>
            </div>

            {/* Section 2: Arbitrator Control Panel */}
            <ArbitrationControl
              escrowInfo={escrowInfo}
              linkDisputeId={linkDisputeId}
              setLinkDisputeId={setLinkDisputeId}
              actionLoading={actionLoading}
              setDisputeContractOnEscrow={setDisputeContractOnEscrow}
              resolveArbitratorDispute={resolveArbitratorDispute}
            />

            {/* Section 3: Pre-generated Key Guidelines */}
            <QuickInfo />
          </div>
        </div>

        {/* 4. Inverted Guide Section */}
        <TutorialSection />
      </main>

      {/* 5. Editorial Footer */}
      <EditorialFooter
        defaultEscrowId={DEFAULT_ESCROW_ID}
        defaultDisputeId={DEFAULT_DISPUTE_ID}
      />
    </div>
  );
}
