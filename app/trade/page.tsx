'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import dynamic from 'next/dynamic';
import SwapInterface from '@/components/SwapInterface';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// Create a client-side only wallet button component
const WalletButton = dynamic(
  () => Promise.resolve(() => (
    <div className="transform hover:scale-105 transition-all duration-300">
      <WalletMultiButton />
    </div>
  )),
  { ssr: false }
);

function TradePageContent() {
  const wallet = useWallet();
  const searchParams = useSearchParams();
  const initialOutputToken = searchParams.get('initialOutputToken') || undefined;

  return (
    <>
      <h1 className="text-2xl font-bold font-mono mb-8 text-foreground">Swap</h1>
      {wallet.connected ? (
        <SwapInterface initialOutputToken={initialOutputToken} />
      ) : (
        <div className="p-8 flex flex-col items-center space-y-4 bg-[#1a1a1a] rounded-2xl border border-white/10">
          <p className="text-center text-foreground font-mono">
            Connect your wallet to start trading
          </p>
          <WalletButton />
        </div>
      )}
    </>
  );
}

export default function TradePage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-72px)] bg-black">
      <div className="flex flex-1 items-start justify-center pt-8" style={{ marginTop: '16px' }}>
        <div className="w-full max-w-lg p-0 shadow-none border-none bg-transparent">
          <Suspense fallback={<div className="text-white">Loading...</div>}>
            <TradePageContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
} 