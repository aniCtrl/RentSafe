'use client';

import React from 'react';
import { formatTimestamp } from '@/lib/rentsafe';
import { getDisputeTimeline, type TimelineRole } from '@/lib/disputeTimeline';
import type { AgreementRecord, DisputeRecord } from '@/lib/rentsafe';

export default function DisputeTimeline({ agreement, dispute, role, disputeLoading, disputeError }: { agreement: AgreementRecord; dispute?: DisputeRecord | null; role: TimelineRole; disputeLoading?: boolean; disputeError?: string | null }) {
  const timeline = getDisputeTimeline(agreement, dispute, role);

  return (
    <section className="surface-card rounded-[24px] border p-6 shadow-sm" aria-labelledby="agreement-progress-heading">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-default pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Agreement progress</p>
          <h3 id="agreement-progress-heading" className="mt-1 text-base font-bold text-primary">{timeline.current.label}</h3>
          <p className="mt-1 max-w-2xl text-xs text-muted">{timeline.explanation}</p>
          {disputeLoading && agreement.status >= 7 && <p className="mt-2 text-[10px] text-link" role="status">Refreshing linked dispute data from Soroban RPC…</p>}
          {!disputeLoading && disputeError && <p className="mt-2 text-[10px] text-danger" role="alert">Dispute data could not be read: {disputeError}</p>}
        </div>
        <div className="status-info rounded-xl border px-3 py-2 text-right text-[10px]">
          <p className="font-bold uppercase tracking-wider">Next action</p>
          <p className="mt-1 font-semibold">{timeline.nextActor}: {timeline.nextAction}</p>
        </div>
      </div>

      <ol className="mt-6 grid gap-3 md:grid-cols-5" aria-label="Agreement lifecycle">
        {timeline.steps.map((step, index) => (
          <li key={step.id} className="relative">
            {index < timeline.steps.length - 1 && <span aria-hidden="true" className="absolute left-5 top-5 hidden h-px w-[calc(100%-1rem)] bg-[var(--border)] md:block" />}
            <div className="relative flex items-start gap-3 md:block">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black ${step.state === 'completed' ? 'status-success' : step.state === 'current' ? 'status-info ring-2 ring-[color-mix(in_srgb,var(--focus)_25%,transparent)]' : 'surface-muted text-subtle'}`} aria-label={`${step.label}: ${step.state}`}>
                {step.state === 'completed' ? <span className="material-symbols-outlined text-base">check</span> : index + 1}
              </span>
              <div className="pt-0.5 md:mt-2">
                <p className={`text-xs font-bold ${step.state === 'upcoming' ? 'text-subtle' : 'text-primary'}`}>{step.label}</p>
                {step.timestamp && <p className="mt-1 text-[10px] text-subtle">{formatTimestamp(step.timestamp)}</p>}
                {step.evidenceLabel && <p className="mt-1 text-[10px] text-link">{step.evidenceLabel}</p>}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
