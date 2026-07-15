import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DappContainer } from "../components/DappContainer";
import { Layout } from "../components/Layout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RentSafe | Decentralized Rental Security Escrow Platform",
  description: "Secure your rental security deposit with programmable, trustless Soroban escrow smart contracts on the Stellar blockchain.",
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-950">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 h-full`}>
        <DappContainer>
          <Layout>
            {children}
          </Layout>
        </DappContainer>
      </body>
    </html>
  );
}
