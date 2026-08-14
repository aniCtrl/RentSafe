'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAppStore, type NotificationRecord } from '@/store/useAppStore';

export default function ToastViewport() {
  const notifications = useAppStore((state) => state.notifications);
  const mountedAt = useRef(0);
  const lastToastId = useRef<string | null>(null);
  const [toast, setToast] = useState<NotificationRecord | null>(null);

  useEffect(() => {
    if (!mountedAt.current) {
      mountedAt.current = Date.now();
      return;
    }
    const latest = notifications.find((notification) => ['transaction', 'system'].includes(notification.type));
    if (!latest || latest.timestamp < mountedAt.current || !['transaction', 'system'].includes(latest.type)) return;
    if (latest.id === lastToastId.current) return;
    lastToastId.current = latest.id;
    setToast(latest);
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notifications]);

  if (!toast) return null;
  const statusClass = toast.severity === 'error' ? 'status-danger' : toast.severity === 'success' ? 'status-success' : toast.severity === 'warning' ? 'status-warning' : 'status-info';

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[60] w-[min(360px,calc(100vw-2rem))]" aria-live="polite">
      <div role="status" className={`pointer-events-auto rounded-2xl border p-4 shadow-xl animate-fadeIn ${statusClass}`}>
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-lg">{toast.severity === 'error' ? 'error' : toast.severity === 'success' ? 'check_circle' : 'info'}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold">{toast.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed">{toast.message}</p>
          </div>
          <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)} className="text-sm opacity-70 hover:opacity-100">×</button>
        </div>
      </div>
    </div>
  );
}
