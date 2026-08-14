'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store/useAppStore';

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { notifications, markNotificationRead, markAllNotificationsRead, clearNotifications } = useAppStore();
  const unread = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-controls="notification-history"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-full p-2 text-muted hover:bg-[var(--surface-muted)] hover:text-primary"
      >
        <span className="material-symbols-outlined text-xl">notifications</span>
        {unread > 0 && <span aria-label={`${unread} unread notifications`} className="status-danger absolute right-0 top-0 min-w-4 h-4 rounded-full border px-1 text-[9px] leading-4 font-bold">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div id="notification-history" className="surface-card absolute right-0 top-12 z-50 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border shadow-2xl animate-fadeIn" role="dialog" aria-label="Notification history">
          <div className="flex items-center justify-between gap-3 border-b border-default px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-primary">Notifications</h3>
              <p className="text-[10px] text-muted">Wallet activity and transaction updates</p>
            </div>
            <div className="flex gap-2 text-[10px] font-bold">
              {unread > 0 && <button type="button" onClick={markAllNotificationsRead} className="text-link hover:underline">Mark all read</button>}
              {notifications.length > 0 && <button type="button" onClick={clearNotifications} className="text-danger hover:underline">Clear</button>}
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto" aria-live="polite">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted">No notifications yet.</p>
            ) : notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.href ?? '/activity-feed'}
                onClick={() => { markNotificationRead(notification.id); setOpen(false); }}
                className={`block border-b border-default px-4 py-3 hover:bg-[var(--surface-muted)] ${notification.read ? 'opacity-70' : 'bg-[var(--surface-muted)]'}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.severity === 'error' ? 'bg-[var(--danger)]' : notification.severity === 'warning' ? 'bg-[var(--warning)]' : notification.severity === 'success' ? 'bg-[var(--success)]' : 'bg-[var(--info)]'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary">{notification.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{notification.message}</p>
                    <p className="mt-1 text-[10px] text-subtle">{new Date(notification.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
