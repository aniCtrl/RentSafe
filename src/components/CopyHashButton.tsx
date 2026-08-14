'use client';

import React, { useState } from 'react';

type CopyHashButtonProps = {
  hash: string;
  compact?: boolean;
  className?: string;
};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();

  const copied = document.execCommand('copy');
  textArea.remove();
  if (!copied) throw new Error('Clipboard copy was not available');
}

export default function CopyHashButton({ hash, compact = false, className = '' }: CopyHashButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await copyText(hash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Transaction hash copied' : 'Copy transaction hash'}
      title={copied ? 'Transaction hash copied' : 'Copy transaction hash'}
      className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-default px-2 py-1 text-[10px] font-semibold text-muted transition-colors hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] ${className}`}
    >
      <span className="material-symbols-outlined text-[13px]">{copied ? 'check' : 'content_copy'}</span>
      {!compact && <span>{copied ? 'Copied' : 'Copy'}</span>}
    </button>
  );
}
