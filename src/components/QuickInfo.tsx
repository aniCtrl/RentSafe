'use client';

import React from 'react';

export default function QuickInfo() {
  return (
    <div className="border border-ink-black p-6 bg-neutral-100 flex flex-col gap-3 sharp-corners">
      <h4 className="font-serif font-bold text-sm uppercase tracking-wider">
        Fig. 2.1 — Key Addresses
      </h4>
      <p className="font-serif text-xs text-neutral-600 leading-normal">
        Use these pre-generated key aliases in your local Freighter keychain to test roles:
      </p>
      <div className="font-mono text-[9px] flex flex-col gap-2 border-t border-dashed border-neutral-300 pt-2 text-neutral-700 select-all">
        <div>
          <strong className="text-ink-black">LANDLORD:</strong>
          <br />
          GBFJINJRIR3JOEOZCNWLSF3B5VENKG2RAGVT4WY4J6AHW32UU2GF3TW3
        </div>
        <div>
          <strong className="text-ink-black">TENANT:</strong>
          <br />
          GB4TTRCTXZ3RNNB6COSWVFWXNPUYWVHX7GI63Z7OC2KYR4BS5W54WAHF
        </div>
        <div>
          <strong className="text-ink-black">ARBITRATOR:</strong>
          <br />
          GAKY5EWWOETAUQQZJPSW3OD5R2N46BE7G24PAHSHLGYLZGTMOLWE7BXT
        </div>
      </div>
    </div>
  );
}
