'use client';

import React, { useState, useEffect } from 'react';
import { initializeWalletsKit, readContractView, writeContractMethod, NATIVE_XLM_ID } from '../lib/stellar';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import { 
  Building2, 
  User, 
  ShieldAlert, 
  Coins, 
  Check, 
  AlertTriangle, 
  Plus, 
  ExternalLink,
  Loader2,
  FileText,
  FileCode2,
  ArrowRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import Marquee from 'react-fast-marquee';

// Deployed Testnet Contract ID Defaults
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

interface EscrowInfo {
  address: string;
  landlord: string;
  tenant: string;
  arbitrator: string;
  token: string;
  amount: bigint;
  state: number;
  disputeContract: string;
}

export default function RentSafePortal() {
  // Wallet State
  const [address, setAddress] = useState<string>('');
  const [balance, setBalance] = useState<string>('0.00');
  const [connecting, setConnecting] = useState<boolean>(false);

  // Escrow Details
  const [escrowId, setEscrowId] = useState<string>(DEFAULT_ESCROW_ID);
  const [escrowInfo, setEscrowInfo] = useState<EscrowInfo | null>(null);
  const [loadingEscrow, setLoadingEscrow] = useState<boolean>(false);
  const [escrowBalance, setEscrowBalance] = useState<string>('0.00');

  // Input States for New Escrow Initialization
  const [newLandlord, setNewLandlord] = useState<string>('');
  const [newTenant, setNewTenant] = useState<string>('');
  const [newArbitrator, setNewArbitrator] = useState<string>('');
  const [newAmount, setNewAmount] = useState<string>('10');

  // Linking State
  const [linkDisputeId, setLinkDisputeId] = useState<string>(DEFAULT_DISPUTE_ID);

  // Action Loading States
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionTx, setActionTx] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Settlement Inputs
  const [landlordShare, setLandlordShare] = useState<string>('3');
  const [tenantShare, setTenantShare] = useState<string>('7');

  // Dispute Inputs
  const [evidenceHash, setEvidenceHash] = useState<string>('0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20');

  // Platform statistics for Marquee Ticker
  const [tickerDate, setTickerDate] = useState<string>('');

  useEffect(() => {
    setTickerDate(new Date().toUTCString());
    fetchEscrowInfo(escrowId);
  }, []);

  useEffect(() => {
    if (address) {
      fetchUserBalance(address);
    }
  }, [address]);

  // Connect Wallet using Stellar Wallet Kit (static class API)
  const connectWallet = async () => {
    try {
      setConnecting(true);
      initializeWalletsKit();
      const res = await StellarWalletsKit.authModal();
      if (res && res.address) {
        setAddress(res.address);
      }
    } catch (err: any) {
      console.error(err);
      alert('Wallet connection failed: ' + err.message);
    } finally {
      setConnecting(false);
    }
  };

  // Fetch Connected User native XLM balance
  const fetchUserBalance = async (userAddr: string) => {
    try {
      const balStroops = await readContractView(NATIVE_XLM_ID, 'balance', [userAddr]);
      setBalance((Number(balStroops) / 10000000).toFixed(2));
    } catch (err) {
      console.error('Failed to fetch user balance:', err);
    }
  };

  // Fetch Escrow Contract Details on-chain
  const fetchEscrowInfo = async (targetId: string) => {
    if (!targetId || targetId.length !== 56) return;
    try {
      setLoadingEscrow(true);
      setActionError(null);
      
      const landlord = await readContractView(targetId, 'get_landlord');
      const tenant = await readContractView(targetId, 'get_tenant');
      const arbitrator = await readContractView(targetId, 'get_arbitrator');
      const token = await readContractView(targetId, 'get_token');
      const amount = await readContractView(targetId, 'get_amount');
      const state = await readContractView(targetId, 'get_state');
      
      let disputeContract = '';
      try {
        disputeContract = await readContractView(targetId, 'get_dispute_contract');
      } catch {
        disputeContract = 'Not Linked Yet';
      }

      setEscrowInfo({
        address: targetId,
        landlord,
        tenant,
        arbitrator,
        token,
        amount: BigInt(amount),
        state,
        disputeContract
      });

      // Get Escrow Contract locked token balance
      const escBalStroops = await readContractView(NATIVE_XLM_ID, 'balance', [targetId]);
      setEscrowBalance((Number(escBalStroops) / 10000000).toFixed(2));
    } catch (err: any) {
      console.error('Failed to load escrow details:', err);
      setActionError(`Failed to fetch escrow contract data: ${err.message}. Make sure the contract ID is correct and active on testnet.`);
      setEscrowInfo(null);
    } finally {
      setLoadingEscrow(false);
    }
  };

  // Determine connected user role
  const getUserRole = () => {
    if (!address || !escrowInfo) return 'Guest';
    if (address.toLowerCase() === escrowInfo.landlord.toLowerCase()) return 'Landlord';
    if (address.toLowerCase() === escrowInfo.tenant.toLowerCase()) return 'Tenant';
    if (address.toLowerCase() === escrowInfo.arbitrator.toLowerCase()) return 'Arbitrator';
    return 'Viewer';
  };

  // Generic contract action dispatcher
  const executeAction = async (method: string, args: any[], name: string) => {
    if (!address) {
      alert('Please connect your wallet first.');
      return;
    }
    try {
      setActionLoading(name);
      setActionTx(null);
      setActionError(null);

      const txHash = await writeContractMethod(escrowId, method, args, address);
      
      setActionTx(txHash);
      // Refresh info after successful execution
      await fetchEscrowInfo(escrowId);
      if (address) await fetchUserBalance(address);
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Transaction failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Initialize a new agreement on-chain
  const initializeNewAgreement = async () => {
    if (!address) return alert('Connect wallet first.');
    if (!newLandlord || !newTenant || !newArbitrator) {
      return alert('Specify Landlord, Tenant, and Arbitrator addresses.');
    }
    try {
      setActionLoading('initialize');
      setActionTx(null);
      setActionError(null);

      const rawAmt = BigInt(parseFloat(newAmount) * 10000000); // convert XLM to stroops

      const txHash = await writeContractMethod(
        escrowId,
        'initialize',
        [newLandlord, newTenant, newArbitrator, NATIVE_XLM_ID, rawAmt],
        address
      );

      setActionTx(txHash);
      await fetchEscrowInfo(escrowId);
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Initialization failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Set Dispute Contract on Escrow
  const setDisputeContractOnEscrow = async () => {
    if (!address) return alert('Connect wallet first.');
    if (!linkDisputeId || linkDisputeId.length !== 56) {
      return alert('Enter a valid 56-character Dispute Contract Address.');
    }
    await executeAction('set_dispute_contract', [linkDisputeId], 'linking');
  };

  // Arbitrator Dispute Payout resolver
  const resolveArbitratorDispute = async () => {
    if (!address) return alert('Connect wallet first.');
    if (!escrowInfo || escrowInfo.disputeContract === 'Not Linked Yet') {
      return alert('Dispute contract not linked.');
    }
    try {
      setActionLoading('resolving');
      setActionTx(null);
      setActionError(null);

      const lShareRaw = BigInt(parseFloat(landlordShare) * 10000000);
      const tShareRaw = BigInt(parseFloat(tenantShare) * 10000000);

      // Invoke resolve directly on the Dispute contract
      const txHash = await writeContractMethod(
        escrowInfo.disputeContract,
        'resolve',
        [lShareRaw, tShareRaw],
        address
      );

      setActionTx(txHash);
      await fetchEscrowInfo(escrowId);
      await fetchUserBalance(address);
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Dispute resolution failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-paper-bg text-ink-black flex flex-col antialiased">
      {/* 1. Header Masthead */}
      <header className="border-b-4 border-ink-black px-4 md:px-8 py-6 max-w-screen-xl w-full mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-ink-black pb-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-[#CC0000] font-bold">Stellar Network Portal</span>
            <h1 className="font-serif text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">
              The RentSafe Gazette
            </h1>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            {address ? (
              <div className="border border-ink-black p-3 bg-white flex flex-col gap-1 w-full md:w-auto sharp-corners">
                <span className="font-mono text-[10px] uppercase text-neutral-500 tracking-wider">Connected Account</span>
                <span className="font-mono text-xs font-bold break-all">{address.substring(0, 10)}...{address.substring(46)}</span>
                <div className="flex justify-between items-center gap-4 mt-1 border-t border-dashed border-neutral-300 pt-1">
                  <span className="font-mono text-xs text-neutral-600">Balance: <strong className="text-ink-black">{balance} XLM</strong></span>
                  <span className="text-[10px] bg-ink-black text-white px-2 py-0.5 uppercase tracking-widest font-mono font-bold">
                    {getUserRole()}
                  </span>
                </div>
              </div>
            ) : (
              <button 
                onClick={connectWallet}
                disabled={connecting}
                className="bg-ink-black text-paper-bg border border-transparent px-6 py-3 uppercase tracking-widest text-xs font-mono font-bold hover:bg-white hover:text-ink-black hover:border-ink-black transition-all duration-200 w-full md:w-auto flex items-center justify-center gap-2 sharp-corners"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Wallet'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Newspaper Sub-Header */}
        <div className="flex justify-between items-center text-xs font-mono py-2 text-neutral-600">
          <span>Vol. I — No. 1</span>
          <span>{tickerDate || 'Loading Edition Date...'}</span>
          <span>Stellar Testnet Edition</span>
        </div>
      </header>

      {/* 2. Scrolling Marquee Ticker */}
      <div className="bg-ink-black text-white py-2 border-b border-ink-black">
        <Marquee gradient={false} speed={40}>
          <div className="flex gap-16 font-mono text-xs uppercase tracking-wider">
            <span>📰 Platform Stats:</span>
            <span>🔑 Deployed Escrow: <strong className="text-[#CC0000]">{DEFAULT_ESCROW_ID.substring(0, 12)}...</strong></span>
            <span>⚖️ Deployed Dispute Contract: <strong className="text-[#CC0000]">{DEFAULT_DISPUTE_ID.substring(0, 12)}...</strong></span>
            <span>⚡ Network: <strong className="text-green-500">Stellar Testnet</strong></span>
            <span>📈 Gas Fee: <strong className="text-yellow-500">Simulated / Dynamic</strong></span>
            <span>🏛️ Platform Custody: <strong className="text-[#CC0000]">Soroban Host Escrow</strong></span>
          </div>
        </Marquee>
      </div>

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
          
          {/* LEFT COLUMN: Escrow Info & Visualizer (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            
            {/* Target Address Selector bar */}
            <div className="border border-ink-black p-6 bg-white flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 sharp-corners">
              <div className="flex-grow">
                <label className="font-mono text-xs uppercase tracking-widest text-neutral-500 font-bold block mb-1">Target Escrow Contract ID</label>
                <input 
                  type="text" 
                  value={escrowId} 
                  onChange={(e) => setEscrowId(e.target.value)}
                  placeholder="Enter 56-char Escrow contract ID"
                  className="w-full border-b-2 border-ink-black bg-transparent py-1 font-mono text-sm focus-visible:bg-neutral-100 focus-visible:outline-none sharp-corners"
                />
              </div>
              <button 
                onClick={() => fetchEscrowInfo(escrowId)}
                disabled={loadingEscrow}
                className="bg-ink-black text-white hover:bg-[#CC0000] px-6 py-3 font-mono text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 sharp-corners disabled:opacity-50"
              >
                {loadingEscrow ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Inspect'}
              </button>
            </div>

            {loadingEscrow ? (
              <div className="border border-ink-black p-16 flex flex-col items-center justify-center gap-4 bg-white min-h-[400px] sharp-corners">
                <Loader2 className="h-10 w-10 animate-spin text-[#CC0000] stroke-1" />
                <span className="font-serif text-lg italic">Reading ledger records...</span>
              </div>
            ) : escrowInfo ? (
              <>
                {/* Visualizer & Metadata */}
                <div className="border border-ink-black bg-white p-6 md:p-8 flex flex-col gap-6 sharp-corners newsprint-texture">
                  <div className="border-b border-ink-black pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                      <span className="font-mono text-[10px] bg-ink-black text-white px-2 py-0.5 uppercase tracking-widest font-bold">Agreement Ledger</span>
                      <h2 className="font-serif text-3xl font-black mt-2">Lease Escrow Record</h2>
                      <p className="font-mono text-xs text-neutral-500 mt-1 break-all">ID: {escrowInfo.address}</p>
                    </div>
                    <div className="text-left md:text-right border-l-4 md:border-l-0 md:border-r-4 border-ink-black pl-3 md:pl-0 pr-3">
                      <span className="font-mono text-[10px] uppercase text-neutral-500 tracking-wider">Locked Balance</span>
                      <div className="font-serif text-3xl font-bold text-[#CC0000]">{escrowBalance} XLM</div>
                    </div>
                  </div>

                  {/* 4. State Machine Visualizer */}
                  <div>
                    <h3 className="font-mono text-xs uppercase tracking-widest text-neutral-500 font-bold mb-4">Lifecycle State Machine</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 border-b border-dashed border-neutral-300 pb-6">
                      {STATE_NAMES.map((s, idx) => {
                        const isCurrent = escrowInfo.state === idx;
                        const isCompleted = escrowInfo.state > idx;
                        return (
                          <div 
                            key={s} 
                            className={`border p-3 flex flex-col justify-between min-h-[90px] sharp-corners transition-all ${
                              isCurrent 
                                ? 'border-[#CC0000] bg-white ring-2 ring-[#CC0000] z-10' 
                                : isCompleted 
                                ? 'border-ink-black bg-neutral-100 opacity-60' 
                                : 'border-neutral-300 bg-neutral-50/50 opacity-40'
                            }`}
                          >
                            <span className="font-mono text-[10px] text-neutral-500 font-bold">Fig. 1.{idx + 1}</span>
                            <div>
                              <span className={`font-serif text-xs block font-bold leading-tight ${isCurrent ? 'text-[#CC0000]' : 'text-ink-black'}`}>
                                {s}
                              </span>
                              {isCurrent && (
                                <span className="font-mono text-[8px] uppercase tracking-widest text-[#CC0000] font-bold block mt-1">Active</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Configuration parameters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
                    <div className="flex flex-col gap-4">
                      <div className="border-b border-neutral-200 pb-2">
                        <span className="text-neutral-500 uppercase tracking-widest block font-bold">Landlord Address</span>
                        <span className="break-all font-bold mt-1 block">{escrowInfo.landlord}</span>
                      </div>
                      <div className="border-b border-neutral-200 pb-2">
                        <span className="text-neutral-500 uppercase tracking-widest block font-bold">Tenant Address</span>
                        <span className="break-all font-bold mt-1 block">{escrowInfo.tenant}</span>
                      </div>
                      <div className="border-b border-neutral-200 pb-2">
                        <span className="text-neutral-500 uppercase tracking-widest block font-bold">Arbitrator Address</span>
                        <span className="break-all font-bold mt-1 block">{escrowInfo.arbitrator}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="border-b border-neutral-200 pb-2">
                        <span className="text-neutral-500 uppercase tracking-widest block font-bold">Required Deposit Size</span>
                        <span className="text-base font-serif font-black block mt-1">{(Number(escrowInfo.amount) / 10000000).toFixed(2)} XLM</span>
                      </div>
                      <div className="border-b border-neutral-200 pb-2">
                        <span className="text-neutral-500 uppercase tracking-widest block font-bold">Stellar Asset Token</span>
                        <span className="break-all text-[11px] block mt-1 text-neutral-600">{escrowInfo.token === NATIVE_XLM_ID ? 'Native Stellar Token (XLM)' : escrowInfo.token}</span>
                      </div>
                      <div className="border-b border-neutral-200 pb-2">
                        <span className="text-neutral-500 uppercase tracking-widest block font-bold">Linked Dispute Contract</span>
                        <span className="break-all font-bold block mt-1 text-neutral-800">{escrowInfo.disputeContract}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Role Specific Actions Panel */}
                <div className="border border-ink-black bg-white p-6 md:p-8 flex flex-col gap-6 sharp-corners">
                  <div className="border-b border-ink-black pb-3">
                    <h3 className="font-serif text-2xl font-black">Authorized Actions Console</h3>
                    <p className="font-mono text-xs text-neutral-500 mt-1">Submit transactions based on your wallet's authorized role.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Tenant Section */}
                    <div className="border border-ink-black p-4 flex flex-col justify-between gap-4 sharp-corners">
                      <div>
                        <div className="flex items-center gap-2 border-b border-ink-black pb-2 mb-2">
                          <User className="h-4 w-4 text-[#CC0000]" />
                          <span className="font-serif text-sm font-bold uppercase tracking-wider">Tenant Desk</span>
                        </div>
                        <p className="text-xs font-serif text-neutral-600">Fund the required escrow deposit or raise a dispute if the landlord behaves in bad faith.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          disabled={escrowInfo.state !== 0 || actionLoading !== null}
                          onClick={() => executeAction('fund', [], 'funding')}
                          className="w-full bg-ink-black text-white hover:bg-neutral-800 text-xs font-mono uppercase tracking-widest font-bold py-3 sharp-corners disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                          {actionLoading === 'funding' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Fund Escrow (Deposit 10 XLM)'}
                        </button>
                      </div>
                    </div>

                    {/* Landlord Section */}
                    <div className="border border-ink-black p-4 flex flex-col justify-between gap-4 sharp-corners">
                      <div>
                        <div className="flex items-center gap-2 border-b border-ink-black pb-2 mb-2">
                          <Building2 className="h-4 w-4 text-[#CC0000]" />
                          <span className="font-serif text-sm font-bold uppercase tracking-wider">Landlord Desk</span>
                        </div>
                        <p className="text-xs font-serif text-neutral-600">Acknowledge receipt and activate the lease once the tenant has fully funded the escrow deposit.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          disabled={escrowInfo.state !== 1 || actionLoading !== null}
                          onClick={() => executeAction('activate', [], 'activation')}
                          className="w-full bg-ink-black text-white hover:bg-neutral-800 text-xs font-mono uppercase tracking-widest font-bold py-3 sharp-corners disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                          {actionLoading === 'activation' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Activate Lease Agreement'}
                        </button>
                      </div>
                    </div>

                    {/* Mutual Settlement Section */}
                    <div className="border border-ink-black p-4 md:col-span-2 flex flex-col gap-4 sharp-corners">
                      <div className="flex items-center gap-2 border-b border-ink-black pb-2">
                        <Coins className="h-4 w-4 text-[#CC0000]" />
                        <span className="font-serif text-sm font-bold uppercase tracking-wider">Mutual Payout Settlement Negotiation</span>
                      </div>
                      <p className="text-xs font-serif text-neutral-600">Either Landlord or Tenant can request a payout split. The counterparty must accept to execute the transfer of locked deposit funds.</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-4 border-t border-dashed border-neutral-300 pt-4">
                        <div>
                          <label className="font-mono text-[10px] uppercase text-neutral-500 font-bold block mb-1">Landlord Share (XLM)</label>
                          <input 
                            type="number"
                            value={landlordShare}
                            onChange={(e) => setLandlordShare(e.target.value)}
                            className="w-full border-b border-ink-black bg-transparent py-1 font-mono text-xs focus-visible:outline-none sharp-corners"
                          />
                        </div>
                        <div>
                          <label className="font-mono text-[10px] uppercase text-neutral-500 font-bold block mb-1">Tenant Share (XLM)</label>
                          <input 
                            type="number"
                            value={tenantShare}
                            onChange={(e) => setTenantShare(e.target.value)}
                            className="w-full border-b border-ink-black bg-transparent py-1 font-mono text-xs focus-visible:outline-none sharp-corners"
                          />
                        </div>
                        <button
                          disabled={(escrowInfo.state !== 2 && escrowInfo.state !== 3) || actionLoading !== null}
                          onClick={() => {
                            const lShare = parseFloat(landlordShare) * 10000000;
                            const tShare = parseFloat(tenantShare) * 10000000;
                            executeAction('request_settlement', [address, BigInt(lShare), BigInt(tShare)], 'settling');
                          }}
                          className="bg-[#CC0000] text-white hover:bg-red-800 text-xs font-mono uppercase tracking-widest font-bold py-3 sharp-corners disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                          {actionLoading === 'settling' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Propose Settlement'}
                        </button>
                      </div>

                      {/* Accept Proposal (if pending) */}
                      {escrowInfo.state === 3 && (
                        <div className="bg-neutral-100 border border-ink-black p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2 sharp-corners">
                          <div>
                            <span className="font-mono text-[10px] uppercase text-neutral-500 font-bold block">Proposed Settlement Awaiting Response</span>
                            <span className="font-serif text-xs mt-1 block">A split is pending. Accept the proposal to authorize payouts and close the escrow agreement.</span>
                          </div>
                          <button
                            disabled={actionLoading !== null}
                            onClick={() => executeAction('accept_settlement', [address], 'accepting')}
                            className="bg-ink-black text-white hover:bg-neutral-800 text-xs font-mono uppercase tracking-widest font-bold px-6 py-3 sharp-corners disabled:opacity-30 flex items-center justify-center gap-2"
                          >
                            {actionLoading === 'accepting' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Accept Proposed Split'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Dispute Filing Section */}
                    <div className="border border-[#CC0000] p-4 md:col-span-2 flex flex-col gap-4 sharp-corners bg-[#FFF9F9]">
                      <div className="flex items-center gap-2 border-b border-[#CC0000] pb-2 text-[#CC0000]">
                        <ShieldAlert className="h-4 w-4" />
                        <span className="font-serif text-sm font-bold uppercase tracking-wider">Raise Lease Dispute (Escrow Lock)</span>
                      </div>
                      <p className="text-xs font-serif text-neutral-600">Either Landlord or Tenant can file a dispute if negotiations break down. This locks the escrow funds in the contract and triggers the linked Dispute contract instance.</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-4 pt-2">
                        <div className="md:col-span-2">
                          <label className="font-mono text-[10px] uppercase text-neutral-500 font-bold block mb-1">Evidence Hash (32-Byte Hex representation)</label>
                          <input 
                            type="text"
                            value={evidenceHash}
                            onChange={(e) => setEvidenceHash(e.target.value)}
                            className="w-full border-b border-ink-black bg-transparent py-1 font-mono text-[10px] focus-visible:outline-none sharp-corners"
                          />
                        </div>
                        <button
                          disabled={(escrowInfo.state !== 2 && escrowInfo.state !== 3) || actionLoading !== null}
                          onClick={() => executeAction('dispute', [address, evidenceHash], 'disputing')}
                          className="bg-ink-black text-white hover:bg-neutral-800 text-xs font-mono uppercase tracking-widest font-bold py-3 sharp-corners disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                          {actionLoading === 'disputing' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Raise Dispute'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="border border-dashed border-neutral-400 p-16 flex flex-col items-center justify-center gap-4 bg-white min-h-[400px] sharp-corners">
                <AlertTriangle className="h-10 w-10 text-neutral-400 stroke-1" />
                <span className="font-serif text-lg italic text-neutral-500">No active Escrow inspected. Enter a contract ID above.</span>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Builders & Arbitrators Panel (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-8">
            
            {/* Section 1: Agreement Register/Initializer */}
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
                  className="w-full bg-ink-black text-white hover:bg-neutral-800 text-xs font-mono uppercase tracking-widest font-bold py-3 mt-2 sharp-corners disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading === 'initialize' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Initialize Agreement'}
                </button>
              </div>
            </div>

            {/* Section 2: Arbitrator Control Room */}
            <div className="border border-ink-black bg-white p-6 flex flex-col gap-4 sharp-corners">
              <div className="border-b border-ink-black pb-2">
                <h3 className="font-serif text-xl font-black text-[#CC0000]">Arbitration Control</h3>
                <p className="font-mono text-[10px] text-neutral-500 mt-1">Exclusive panel for the designated dispute arbitrator.</p>
              </div>

              <div className="flex flex-col gap-4 font-mono text-xs">
                {/* Link dispute contract */}
                <div className="border-b border-dashed border-neutral-300 pb-4">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Link Dispute Contract (Only Arbitrator)</span>
                  <input 
                    type="text" 
                    value={linkDisputeId}
                    onChange={(e) => setLinkDisputeId(e.target.value)}
                    placeholder="Enter Dispute Contract Address"
                    className="w-full border-b border-ink-black bg-transparent py-1 text-[10px] focus-visible:outline-none sharp-corners mb-2"
                  />
                  <button
                    disabled={actionLoading !== null}
                    onClick={setDisputeContractOnEscrow}
                    className="w-full border border-ink-black text-ink-black hover:bg-ink-black hover:text-white text-xs font-mono uppercase tracking-widest font-bold py-2 sharp-corners disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading === 'linking' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Link Dispute Address'}
                  </button>
                </div>

                {/* Resolve Dispute */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#CC0000] block mb-1">Enforce Dispute Payout (Only Arbitrator)</span>
                  <p className="text-[10px] font-serif text-neutral-600 mb-3">Enforce a split and execute transfers. These parameters are routed through the Dispute contract callback.</p>
                  
                  <div className="flex flex-col gap-3">
                    <button
                      disabled={!escrowInfo || escrowInfo.state !== 4 || actionLoading !== null}
                      onClick={resolveArbitratorDispute}
                      className="w-full bg-[#CC0000] text-white hover:bg-red-800 text-xs font-mono uppercase tracking-widest font-bold py-3 sharp-corners disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                      {actionLoading === 'resolving' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Enforce & Payout Split'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Info Section */}
            <div className="border border-ink-black p-6 bg-neutral-100 flex flex-col gap-3 sharp-corners">
              <h4 className="font-serif font-bold text-sm uppercase tracking-wider">Fig. 2.1 — Key Addresses</h4>
              <p className="font-serif text-xs text-neutral-600 leading-normal">Use these pre-generated key aliases in your local Freighter keychain to test roles:</p>
              <div className="font-mono text-[9px] flex flex-col gap-2 border-t border-dashed border-neutral-300 pt-2 text-neutral-700">
                <div>
                  <strong className="text-ink-black">LANDLORD:</strong><br />
                  GBFJINJRIR3JOEOZCNWLSF3B5VENKG2RAGVT4WY4J6AHW32UU2GF3TW3
                </div>
                <div>
                  <strong className="text-ink-black">TENANT:</strong><br />
                  GB4TTRCTXZ3RNNB6COSWVFWXNPUYWVHX7GI63Z7OC2KYR4BS5W54WAHF
                </div>
                <div>
                  <strong className="text-ink-black">ARBITRATOR:</strong><br />
                  GAKY5EWWOETAUQQZJPSW3OD5R2N46BE7G24PAHSHLGYLZGTMOLWE7BXT
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Inverted Section: How it Works (stark Newsprint style) */}
        <section className="bg-ink-black text-paper-bg p-8 md:p-12 mt-16 sharp-corners newsprint-texture">
          <div className="max-w-3xl mx-auto flex flex-col gap-8">
            <div className="border-b border-neutral-600 pb-4 text-center">
              <span className="font-mono text-xs uppercase tracking-widest text-[#CC0000] font-bold">Protocol Tutorial</span>
              <h2 className="font-serif text-3xl md:text-5xl font-black uppercase mt-1">How RentSafe Works</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col gap-2">
                <div className="font-serif text-4xl md:text-5xl font-black text-[#CC0000]">01.</div>
                <h3 className="font-serif text-lg font-bold">Lock Deposit</h3>
                <p className="font-serif text-xs text-neutral-300 leading-relaxed">The Tenant funds the rental agreement, transferring the deposit amount into the Escrow contract custody on-chain.</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="font-serif text-4xl md:text-5xl font-black text-[#CC0000]">02.</div>
                <h3 className="font-serif text-lg font-bold">Activate Lease</h3>
                <p className="font-serif text-xs text-neutral-300 leading-relaxed">The Landlord activates the agreement, starting the active lease period. Funds remain locked securely in the host contract.</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="font-serif text-4xl md:text-5xl font-black text-[#CC0000]">03.</div>
                <h3 className="font-serif text-lg font-bold">Resolve / Settle</h3>
                <p className="font-serif text-xs text-neutral-300 leading-relaxed">Either settle the deposit mutually at lease end, or utilize the designated arbitrator to execute payout splits under a dispute.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 6. Footer */}
      <footer className="border-t-4 border-ink-black bg-white py-12 px-4 md:px-8 mt-auto">
        <div className="max-w-screen-xl mx-auto grid grid-span-12 md:grid-cols-4 gap-8 font-mono text-xs text-neutral-600">
          <div className="md:col-span-2 flex flex-col gap-4">
            <h4 className="font-serif text-lg font-black text-ink-black uppercase">RentSafe Platforms Inc.</h4>
            <p className="font-serif text-xs text-neutral-500 leading-relaxed">
              Decentralized rental deposit clearing house built entirely on Stellar/Soroban host specifications. Registered edition: Vol 1.0. Printed in NYC.
            </p>
          </div>
          <div>
            <h5 className="font-bold text-ink-black uppercase mb-3">On-Chain Links</h5>
            <ul className="flex flex-col gap-2">
              <li><a href={`https://stellar.expert/explorer/testnet/contract/${DEFAULT_ESCROW_ID}`} target="_blank" rel="noreferrer" className="hover:text-ink-black flex items-center gap-1">Escrow Explorer <ExternalLink className="h-3 w-3" /></a></li>
              <li><a href={`https://stellar.expert/explorer/testnet/contract/${DEFAULT_DISPUTE_ID}`} target="_blank" rel="noreferrer" className="hover:text-ink-black flex items-center gap-1">Dispute Explorer <ExternalLink className="h-3 w-3" /></a></li>
              <li><a href="https://stellar.org" target="_blank" rel="noreferrer" className="hover:text-ink-black flex items-center gap-1">Stellar Foundation <ExternalLink className="h-3 w-3" /></a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-ink-black uppercase mb-3">Specifications</h5>
            <ul className="flex flex-col gap-2">
              <li>Network: Testnet</li>
              <li>Gas System: Soroban RPC</li>
              <li>Client version: NextJS v15</li>
            </ul>
          </div>
        </div>
        <div className="max-w-screen-xl mx-auto border-t border-dashed border-neutral-300 mt-8 pt-4 text-center font-mono text-[10px] text-neutral-400">
          &copy; {new Date().getFullYear()} RentSafe. All The News That's Fit To Print.
        </div>
      </footer>
    </div>
  );
}
