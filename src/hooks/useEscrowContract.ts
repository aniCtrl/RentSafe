'use client';

import { useState, useEffect } from 'react';
import { initializeWalletsKit, readContractView, writeContractMethod, NATIVE_XLM_ID } from '../lib/stellar';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';

const DEFAULT_ESCROW_ID = 'CBPI35R5GHDJOVGE6CET2FKDJ2I77KCKOXWQ62NHGQN4YCV3MS7OS2Q7';
const DEFAULT_DISPUTE_ID = 'CCTC5ZQPSXD6DVXNRTJBTJC32PTPAGAWQEBPVKJHQAI5UZVS54TF4BSX';

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

export function useEscrowContract() {
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

  return {
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
  };
}
