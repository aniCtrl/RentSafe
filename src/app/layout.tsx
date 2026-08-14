import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';

const themeInitScript = `(() => {
  try {
    const raw = window.localStorage.getItem('rentsafe-app-store');
    const parsed = raw ? JSON.parse(raw) : null;
    const mode = parsed?.state?.themeMode === 'dark' || parsed?.themeMode === 'dark' ? 'dark' : 'light';
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.classList.toggle('dark', mode === 'dark');
    root.classList.toggle('light', mode === 'light');
  } catch (_) {}
})();`;

export const metadata: Metadata = {
  title: 'RentSafe - Secured Rental Escrow agreements',
  description: 'Rental deposits, secured by code, not trust. Decentralized escrow built on the Stellar blockchain. Fast, fair, and fully automated.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" className="light h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="app-body antialiased h-full flex flex-col">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
