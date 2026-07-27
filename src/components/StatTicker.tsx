'use client';

import React from 'react';
import Marquee from 'react-fast-marquee';

interface StatTickerProps {
  defaultEscrowId: string;
  defaultDisputeId: string;
}

export default function StatTicker({ defaultEscrowId, defaultDisputeId }: StatTickerProps) {
  return (
    <div className="bg-ink-black text-white py-2 border-b border-ink-black select-none">
      <Marquee gradient={false} speed={40}>
        <div className="flex gap-16 font-mono text-xs uppercase tracking-wider">
          <span>📰 Platform Stats:</span>
          <span>
            🔑 Deployed Escrow:{' '}
            <strong className="text-[#CC0000]">{defaultEscrowId.substring(0, 12)}...</strong>
          </span>
          <span>
            ⚖️ Deployed Dispute Contract:{' '}
            <strong className="text-[#CC0000]">{defaultDisputeId.substring(0, 12)}...</strong>
          </span>
          <span>
            ⚡ Network: <strong className="text-green-500">Stellar Testnet</strong>
          </span>
          <span>
            📈 Gas Fee: <strong className="text-yellow-500">Simulated / Dynamic</strong>
          </span>
          <span>
            🏛️ Platform Custody: <strong className="text-[#CC0000]">Soroban Host Escrow</strong>
          </span>
        </div>
      </Marquee>
    </div>
  );
}
