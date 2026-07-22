'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

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

interface ArbitrationControlProps {
  escrowInfo: EscrowInfo | null;
  linkDisputeId: string;
  setLinkDisputeId: (val: string) => void;
  actionLoading: string | null;
  setDisputeContractOnEscrow: () => Promise<void>;
  resolveArbitratorDispute: () => Promise<void>;
}

export default function ArbitrationControl({
  escrowInfo,
  linkDisputeId,
  setLinkDisputeId,
  actionLoading,
  setDisputeContractOnEscrow,
  resolveArbitratorDispute,
}: ArbitrationControlProps) {
  return (
    <div className="border border-ink-black bg-white p-6 flex flex-col gap-4 sharp-corners">
      <div className="border-b border-ink-black pb-2">
        <h3 className="font-serif text-xl font-black text-[#CC0000]">Arbitration Control</h3>
        <p className="font-mono text-[10px] text-neutral-500 mt-1">
          Exclusive panel for the designated dispute arbitrator.
        </p>
      </div>

      <div className="flex flex-col gap-4 font-mono text-xs">
        {/* Link dispute contract */}
        <div className="border-b border-dashed border-neutral-300 pb-4">
          <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
            Link Dispute Contract (Only Arbitrator)
          </span>
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
            className="w-full border border-ink-black text-ink-black hover:bg-ink-black hover:text-white text-xs font-mono uppercase tracking-widest font-bold py-2 sharp-corners disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
          >
            {actionLoading === 'linking' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              'Link Dispute Address'
            )}
          </button>
        </div>

        {/* Resolve Dispute */}
        <div>
          <span className="text-[10px] uppercase font-bold text-[#CC0000] block mb-1">
            Enforce Dispute Payout (Only Arbitrator)
          </span>
          <p className="text-[10px] font-serif text-neutral-600 mb-3">
            Enforce a split and execute transfers. These parameters are routed through the Dispute
            contract callback.
          </p>

          <div className="flex flex-col gap-3">
            <button
              disabled={!escrowInfo || escrowInfo.state !== 4 || actionLoading !== null}
              onClick={resolveArbitratorDispute}
              className="w-full bg-[#CC0000] text-white hover:bg-red-800 text-xs font-mono uppercase tracking-widest font-bold py-3 sharp-corners disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
            >
              {actionLoading === 'resolving' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                'Enforce & Payout Split'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
