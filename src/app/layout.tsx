import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RentSafe — Decentralized Rental Deposit Escrow Platform",
  description: "Secure, trustless rental deposits locked in escrow and managed on the Stellar network with arbitrator-backed dispute resolution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-paper-bg text-ink-black sharp-corners">
        {children}
      </body>
    </html>
  );
}
