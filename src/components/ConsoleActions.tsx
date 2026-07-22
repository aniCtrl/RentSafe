'use client';

import React from 'react';
import { User, Building2, Coins, ShieldAlert, Loader2 } from 'lucide-react';

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

interface ConsoleActionsProps {
  escrowInfo: EscrowInfo;
  address: string;
  actionLoading: string | null;
  executeAction: (method: string, args: any[], name: string) => Promise<void>;
  landlordShare: string;
  setLandlordShare: (val: string) => void;
  tenantShare: string;
  setTenantShare: (val: string) => void;
  evidenceHash: string;
  setEvidenceHash: (val: string) => void;
}

export default function ConsoleActions({
  escrowInfo,
  address,
  actionLoading,
  executeAction,
  landlordShare,
  setLandlordShare,
  tenantShare,
  setTenantShare,
  evidenceHash,
  setEvidenceHash,
}: ConsoleActionsProps) {
  return (
    <div className="border border-ink-black bg-white p-6 md:p-8 flex flex-col gap-6 sharp-corners animate-fadeIn">
      <div className="border-b border-ink-black pb-3">
        <h3 className="font-serif text-2xl font-black">Authorized Actions Console</h3>
        <p className="font-mono text-xs text-neutral-500 mt-1">
          Submit transactions based on your wallet's authorized role.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tenant Section */}
        <div className="border border-ink-black p-4 flex flex-col justify-between gap-4 sharp-corners">
          <div>
            <div className="flex items-center gap-2 border-b border-ink-black pb-2 mb-2">
              <User className="h-4 w-4 text-[#CC0000]" />
              <span className="font-serif text-sm font-bold uppercase tracking-wider">
                Tenant Desk
              </span>
            </div>
            <p className="text-xs font-serif text-neutral-600">
              Fund the required escrow deposit or raise a dispute if the landlord behaves in bad
              faith.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              disabled={escrowInfo.state !== 0 || actionLoading !== null}
              onClick={() => executeAction('fund', [], 'funding')}
              className="w-full bg-ink-black text-white hover:bg-neutral-800 text-xs font-mono uppercase tracking-widest font-bold py-3 sharp-corners disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {actionLoading === 'funding' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                'Fund Escrow (Deposit 10 XLM)'
              )}
            </button>
          </div>
        </div>

        {/* Landlord Section */}
        <div className="border border-ink-black p-4 flex flex-col justify-between gap-4 sharp-corners">
          <div>
            <div className="flex items-center gap-2 border-b border-ink-black pb-2 mb-2">
              <Building2 className="h-4 w-4 text-[#CC0000]" />
              <span className="font-serif text-sm font-bold uppercase tracking-wider">
                Landlord Desk
              </span>
            </div>
            <p className="text-xs font-serif text-neutral-600">
              Acknowledge receipt and activate the lease once the tenant has fully funded the
              escrow deposit.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              disabled={escrowInfo.state !== 1 || actionLoading !== null}
              onClick={() => executeAction('activate', [], 'activation')}
              className="w-full bg-ink-black text-white hover:bg-neutral-800 text-xs font-mono uppercase tracking-widest font-bold py-3 sharp-corners disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {actionLoading === 'activation' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                'Activate Lease Agreement'
              )}
            </button>
          </div>
        </div>

        {/* Mutual Settlement Section */}
        <div className="border border-ink-black p-4 md:col-span-2 flex flex-col gap-4 sharp-corners">
          <div className="flex items-center gap-2 border-b border-ink-black pb-2">
            <Coins className="h-4 w-4 text-[#CC0000]" />
            <span className="font-serif text-sm font-bold uppercase tracking-wider">
              Mutual Payout Settlement Negotiation
            </span>
          </div>
          <p className="text-xs font-serif text-neutral-600">
            Either Landlord or Tenant can request a payout split. The counterparty must accept
            to execute the transfer of locked deposit funds.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-4 border-t border-dashed border-neutral-300 pt-4">
            <div>
              <label className="font-mono text-[10px] uppercase text-neutral-500 font-bold block mb-1">
                Landlord Share (XLM)
              </label>
              <input
                type="number"
                value={landlordShare}
                onChange={(e) => setLandlordShare(e.target.value)}
                className="w-full border-b border-ink-black bg-transparent py-1 font-mono text-xs focus-visible:outline-none sharp-corners"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-neutral-500 font-bold block mb-1">
                Tenant Share (XLM)
              </label>
              <input
                type="number"
                value={tenantShare}
                onChange={(e) => setTenantShare(e.target.value)}
                className="w-full border-b border-ink-black bg-transparent py-1 font-mono text-xs focus-visible:outline-none sharp-corners"
              />
            </div>
            <button
              disabled={
                (escrowInfo.state !== 2 && escrowInfo.state !== 3) || actionLoading !== null
              }
              onClick={() => {
                const lShare = parseFloat(landlordShare) * 10000000;
                const tShare = parseFloat(tenantShare) * 10000000;
                executeAction(
                  'request_settlement',
                  [address, BigInt(lShare), BigInt(tShare)],
                  'settling'
                );
              }}
              className="bg-[#CC0000] text-white hover:bg-red-800 text-xs font-mono uppercase tracking-widest font-bold py-3 sharp-corners disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {actionLoading === 'settling' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                'Propose Settlement'
              )}
            </button>
          </div>

          {/* Accept Proposal */}
          {escrowInfo.state === 3 && (
            <div className="bg-neutral-100 border border-ink-black p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2 sharp-corners animate-fadeIn">
              <div>
                <span className="font-mono text-[10px] uppercase text-neutral-500 font-bold block">
                  Proposed Settlement Awaiting Response
                </span>
                <span className="font-serif text-xs mt-1 block">
                  A split is pending. Accept the proposal to authorize payouts and close the
                  escrow agreement.
                </span>
              </div>
              <button
                disabled={actionLoading !== null}
                onClick={() => executeAction('accept_settlement', [address], 'accepting')}
                className="bg-ink-black text-white hover:bg-neutral-800 text-xs font-mono uppercase tracking-widest font-bold px-6 py-3 sharp-corners disabled:opacity-30 flex items-center justify-center gap-2 cursor-pointer"
              >
                {actionLoading === 'accepting' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'Accept Proposed Split'
                )}
              </button>
            </div>
          )}
        </div>

        {/* Dispute Filing Section */}
        <div className="border border-[#CC0000] p-4 md:col-span-2 flex flex-col gap-4 sharp-corners bg-[#FFF9F9]">
          <div className="flex items-center gap-2 border-b border-[#CC0000] pb-2 text-[#CC0000]">
            <ShieldAlert className="h-4 w-4" />
            <span className="font-serif text-sm font-bold uppercase tracking-wider">
              Raise Lease Dispute (Escrow Lock)
            </span>
          </div>
          <p className="text-xs font-serif text-neutral-600">
            Either Landlord or Tenant can file a dispute if negotiations break down. This locks
            the escrow funds in the contract and triggers the linked Dispute contract instance.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-4 pt-2">
            <div className="md:col-span-2">
              <label className="font-mono text-[10px] uppercase text-neutral-500 font-bold block mb-1">
                Evidence Hash (32-Byte Hex representation)
              </label>
              <input
                type="text"
                value={evidenceHash}
                onChange={(e) => setEvidenceHash(e.target.value)}
                className="w-full border-b border-ink-black bg-transparent py-1 font-mono text-[10px] focus-visible:outline-none sharp-corners"
              />
            </div>
            <button
              disabled={
                (escrowInfo.state !== 2 && escrowInfo.state !== 3) || actionLoading !== null
              }
              onClick={() => executeAction('dispute', [address, evidenceHash], 'disputing')}
              className="bg-ink-black text-white hover:bg-neutral-800 text-xs font-mono uppercase tracking-widest font-bold py-3 sharp-corners disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {actionLoading === 'disputing' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                'Raise Dispute'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
