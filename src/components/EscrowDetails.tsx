'use client';

import React from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

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

interface EscrowDetailsProps {
  escrowId: string;
  setEscrowId: (val: string) => void;
  loadingEscrow: boolean;
  fetchEscrowInfo: (id: string) => void;
  escrowInfo: EscrowInfo | null;
  escrowBalance: string;
  nativeXlmId: string;
  stateNames: string[];
}

export default function EscrowDetails({
  escrowId,
  setEscrowId,
  loadingEscrow,
  fetchEscrowInfo,
  escrowInfo,
  escrowBalance,
  nativeXlmId,
  stateNames,
}: EscrowDetailsProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* Target Address Inspector Field */}
      <div className="border border-ink-black p-6 bg-white flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 sharp-corners">
        <div className="flex-grow">
          <label className="font-mono text-xs uppercase tracking-widest text-neutral-500 font-bold block mb-1">
            Target Escrow Contract ID
          </label>
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
          className="bg-ink-black text-white hover:bg-[#CC0000] px-6 py-3 font-mono text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 sharp-corners disabled:opacity-50 cursor-pointer"
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
        <div className="border border-ink-black bg-white p-6 md:p-8 flex flex-col gap-6 sharp-corners newsprint-texture animate-fadeIn">
          {/* Metadata Header */}
          <div className="border-b border-ink-black pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="font-mono text-[10px] bg-ink-black text-white px-2 py-0.5 uppercase tracking-widest font-bold">
                Agreement Ledger
              </span>
              <h2 className="font-serif text-3xl font-black mt-2">Lease Escrow Record</h2>
              <p className="font-mono text-xs text-neutral-500 mt-1 break-all">ID: {escrowInfo.address}</p>
            </div>
            <div className="text-left md:text-right border-l-4 md:border-l-0 md:border-r-4 border-ink-black pl-3 md:pl-0 pr-3">
              <span className="font-mono text-[10px] uppercase text-neutral-500 tracking-wider">
                Locked Balance
              </span>
              <div className="font-serif text-3xl font-bold text-[#CC0000]">
                {escrowBalance} XLM
              </div>
            </div>
          </div>

          {/* State Machine Grid */}
          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-neutral-500 font-bold mb-4">
              Lifecycle State Machine
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 border-b border-dashed border-neutral-300 pb-6">
              {stateNames.map((s, idx) => {
                const isCurrent = escrowInfo.state === idx;
                const isCompleted = escrowInfo.state > idx;
                return (
                  <div
                    key={s}
                    className={`border p-3 flex flex-col justify-between min-h-[90px] sharp-corners transition-all ${
                      isCurrent
                        ? 'border-[#CC0000] bg-white ring-2 ring-[#CC0000] z-10 font-bold'
                        : isCompleted
                        ? 'border-ink-black bg-neutral-100 opacity-60'
                        : 'border-neutral-300 bg-neutral-50/50 opacity-40'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-neutral-500 font-bold">
                      Fig. 1.{idx + 1}
                    </span>
                    <div>
                      <span
                        className={`font-serif text-xs block font-bold leading-tight ${
                          isCurrent ? 'text-[#CC0000]' : 'text-ink-black'
                        }`}
                      >
                        {s}
                      </span>
                      {isCurrent && (
                        <span className="font-mono text-[8px] uppercase tracking-widest text-[#CC0000] font-bold block mt-1">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            <div className="flex flex-col gap-4">
              <div className="border-b border-neutral-200 pb-2">
                <span className="text-neutral-500 uppercase tracking-widest block font-bold">
                  Landlord Address
                </span>
                <span className="break-all font-bold mt-1 block">{escrowInfo.landlord}</span>
              </div>
              <div className="border-b border-neutral-200 pb-2">
                <span className="text-neutral-500 uppercase tracking-widest block font-bold">
                  Tenant Address
                </span>
                <span className="break-all font-bold mt-1 block">{escrowInfo.tenant}</span>
              </div>
              <div className="border-b border-neutral-200 pb-2">
                <span className="text-neutral-500 uppercase tracking-widest block font-bold">
                  Arbitrator Address
                </span>
                <span className="break-all font-bold mt-1 block">{escrowInfo.arbitrator}</span>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="border-b border-neutral-200 pb-2">
                <span className="text-neutral-500 uppercase tracking-widest block font-bold">
                  Required Deposit Size
                </span>
                <span className="text-base font-serif font-black block mt-1">
                  {(Number(escrowInfo.amount) / 10000000).toFixed(2)} XLM
                </span>
              </div>
              <div className="border-b border-neutral-200 pb-2">
                <span className="text-neutral-500 uppercase tracking-widest block font-bold">
                  Stellar Asset Token
                </span>
                <span className="break-all text-[11px] block mt-1 text-neutral-600">
                  {escrowInfo.token === nativeXlmId
                    ? 'Native Stellar Token (XLM)'
                    : escrowInfo.token}
                </span>
              </div>
              <div className="border-b border-neutral-200 pb-2">
                <span className="text-neutral-500 uppercase tracking-widest block font-bold">
                  Linked Dispute Contract
                </span>
                <span className="break-all font-bold block mt-1 text-neutral-800">
                  {escrowInfo.disputeContract}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-neutral-400 p-16 flex flex-col items-center justify-center gap-4 bg-white min-h-[400px] sharp-corners">
          <AlertTriangle className="h-10 w-10 text-neutral-400 stroke-1" />
          <span className="font-serif text-lg italic text-neutral-500 text-center">
            No active Escrow inspected. Enter a contract ID above.
          </span>
        </div>
      )}
    </div>
  );
}
