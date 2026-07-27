'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';

interface EditorialFooterProps {
  defaultEscrowId: string;
  defaultDisputeId: string;
}

export default function EditorialFooter({
  defaultEscrowId,
  defaultDisputeId,
}: EditorialFooterProps) {
  return (
    <footer className="border-t-4 border-ink-black bg-white py-12 px-4 md:px-8 mt-auto">
      <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 font-mono text-xs text-neutral-600">
        <div className="md:col-span-2 flex flex-col gap-4">
          <h4 className="font-serif text-lg font-black text-ink-black uppercase">
            RentSafe Platforms Inc.
          </h4>
          <p className="font-serif text-xs text-neutral-500 leading-relaxed">
            Decentralized rental deposit clearing house built entirely on Stellar/Soroban host
            specifications. Registered edition: Vol 1.0. Printed in NYC.
          </p>
        </div>
        <div>
          <h5 className="font-bold text-ink-black uppercase mb-3">On-Chain Links</h5>
          <ul className="flex flex-col gap-2">
            <li>
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${defaultEscrowId}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-ink-black hover:underline flex items-center gap-1"
              >
                Escrow Explorer <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${defaultDisputeId}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-ink-black hover:underline flex items-center gap-1"
              >
                Dispute Explorer <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              <a
                href="https://stellar.org"
                target="_blank"
                rel="noreferrer"
                className="hover:text-ink-black hover:underline flex items-center gap-1"
              >
                Stellar Foundation <ExternalLink className="h-3 w-3" />
              </a>
            </li>
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
  );
}
