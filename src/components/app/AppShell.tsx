'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { DEFAULT_PLATFORM_ADMIN_ID } from '@/lib/stellar';
import { useAppStore } from '@/store/useAppStore';
import { formatAgreementId, parseAgreementSlug } from '@/lib/rentsafe';

const WalletConnectModal = dynamic(() => import('@/components/WalletConnectModal'), { ssr: false });

type AppShellProps = {
  title: string;
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
  match: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    match: (pathname) => pathname === '/dashboard',
  },
  {
    href: '/inspect-escrow',
    label: 'Inspect Escrow',
    icon: 'search',
    match: (pathname) => pathname.startsWith('/inspect-escrow'),
  },
  {
    href: '/create',
    label: 'Create',
    icon: 'add_circle',
    match: (pathname) => pathname === '/create',
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: 'monitoring',
    match: (pathname) => pathname === '/analytics',
  },
  {
    href: '/admin',
    label: 'Admin',
    icon: 'admin_panel_settings',
    adminOnly: true,
    match: (pathname) => pathname === '/admin',
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: 'settings',
    match: (pathname) => pathname === '/settings',
  },
];

export default function AppShell({ title, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { address, balance, escrowId, resetSession } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const isAdmin = !!address && address.toLowerCase() === DEFAULT_PLATFORM_ADMIN_ID.toLowerCase();

  const visibleNavItems = useMemo(() => NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin), [isAdmin]);

  const searchSeed = useMemo(() => {
    if (pathname.startsWith('/inspect-escrow/')) {
      const parts = pathname.split('/');
      const segment = parts[parts.length - 1] || '';
      const numericId = parseAgreementSlug(segment);
      if (!isNaN(numericId) && numericId > 0) {
        return segment.toUpperCase().startsWith('RS-') ? segment.toUpperCase() : formatAgreementId(numericId);
      }
      return segment;
    }

    if (escrowId) {
      const numericId = Number(escrowId);
      if (!isNaN(numericId) && numericId > 0) {
        return formatAgreementId(numericId);
      }
    }
    return '';
  }, [pathname, escrowId]);

  const activeHref = useMemo(() => {
    const activeItem = visibleNavItems.find((item) => item.match(pathname));
    return activeItem?.href ?? '/dashboard';
  }, [pathname, visibleNavItems]);

  const handleInspectSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const trimmed = String(formData.get('agreementId') ?? '').trim();
    if (!trimmed) {
      router.push('/inspect-escrow');
      return;
    }
    const numericId = parseAgreementSlug(trimmed);
    if (!isNaN(numericId) && numericId > 0) {
      const formatted = trimmed.toUpperCase().startsWith('RS-') ? trimmed.toUpperCase() : formatAgreementId(numericId);
      router.push(`/inspect-escrow/${formatted}`);
    } else {
      router.push(`/inspect-escrow/${trimmed}`);
    }
  };

  return (
    <div className="bg-[#f9f9f9] text-[#1a1c1c] font-sans min-h-screen overflow-x-hidden antialiased flex flex-col md:flex-row pb-16 md:pb-0">
      <aside className="hidden md:flex bg-[#ffffff] border-r border-[#e2e2e2] h-screen w-64 flex-col z-30 p-6 shrink-0 sticky top-0">
        <Link href="/dashboard" className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#000000] flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-xl">real_estate_agent</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#000000]">RentSafe</h1>
            <p className="text-[10px] text-[#585f6c] font-semibold uppercase tracking-wider">Control Panel</p>
          </div>
        </Link>

        <div className="bg-[#f3f3f3] rounded-2xl px-4 py-3 flex items-center justify-between border border-[#e2e2e2] mb-6">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${address ? 'bg-emerald-500' : 'bg-[#747878]'}`} />
            <span className="text-xs font-semibold font-mono truncate text-[#000000]">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not Connected'}</span>
          </div>
          {address ? (
            <button
              onClick={async () => {
                const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');
                await StellarWalletsKit.disconnect();
                resetSession();
              }}
              title="Disconnect Wallet"
              className="material-symbols-outlined text-sm text-[#747878] hover:text-[#000000] cursor-pointer"
            >
              logout
            </button>
          ) : (
            <button onClick={() => setModalOpen(true)} className="text-[10px] font-bold text-black underline hover:opacity-80">
              Connect
            </button>
          )}
        </div>

        <nav className="flex-1 flex flex-col gap-1">
          {visibleNavItems.map((item) => {
            const isActive = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors ${
                  isActive ? 'bg-[#dce2f3] text-[#151c27]' : 'text-[#585f6c] hover:text-[#000000] hover:bg-[#f3f3f3]'
                }`}
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 border-t border-[#e2e2e2] pt-4">
          <p className="text-[10px] text-[#585f6c] mb-1 font-semibold">BALANCE</p>
          <p className="text-lg font-black text-[#000000]">{balance} XLM</p>
        </div>
      </aside>

      <div className="flex-grow flex flex-col min-h-screen">
        <header className="bg-[#ffffff] border-b border-[#e2e2e2] h-16 min-h-[64px] shrink-0 flex justify-between items-center px-6 sticky top-0 z-20">
          <h2 className="text-base font-bold text-[#000000] tracking-tight">{title}</h2>

          <div className="flex items-center gap-4">
            <form onSubmit={handleInspectSubmit} className="relative hidden md:flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-[#747878] text-lg pointer-events-none">search</span>
              <input
                key={searchSeed}
                name="agreementId"
                type="text"
                defaultValue={searchSeed}
                placeholder="Inspect Agreement ID..."
                className="pl-9 pr-4 py-1.5 bg-[#f3f3f3] border border-[#c4c7c7]/50 rounded-full text-xs focus:outline-none focus:border-black w-64 text-[#000000] placeholder-[#747878]"
              />
            </form>

            {address ? (
              <span className="text-xs text-[#585f6c] font-mono bg-[#eeeeee] px-2.5 py-1.5 rounded-lg border border-[#c4c7c7]/30 md:hidden">
                {address.slice(0, 4)}...{address.slice(-4)}
              </span>
            ) : (
              <button onClick={() => setModalOpen(true)} className="bg-[#000000] text-white px-4 py-2 rounded-full text-xs font-bold hover:opacity-90 transition-opacity">
                Connect Wallet
              </button>
            )}
          </div>
        </header>

        <main className="flex-grow p-6 md:p-8 max-w-6xl mx-auto w-full">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#ffffff] border-t border-[#e2e2e2] h-16 flex justify-around items-center z-40 px-2">
        {visibleNavItems.map((item) => {
          const isActive = activeHref === item.href;
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center text-[10px] font-bold ${isActive ? 'text-black' : 'text-[#747878]'}`}>
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              <span>{item.label === 'Dashboard' ? 'Home' : item.label.replace(' Escrow', '')}</span>
            </Link>
          );
        })}
      </nav>

      <WalletConnectModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
