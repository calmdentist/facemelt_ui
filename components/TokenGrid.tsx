"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getRandomPastelColor } from "@/lib/utils";
import { useRouter } from 'next/navigation';
import { calculateMarketCap as calculateTokenMarketCap, calculateLiquidity } from "@/utils/poolCalculations";

interface Token {
  address: string;
  tokenMint: string;
  tokenReserve: string;
  effectiveTokenReserve: string;
  solReserve: string;
  effectiveSolReserve: string;
  totalDeltaKLongs: string;
  totalDeltaKShorts: string;
  fundingConstantC: string;
  lastUpdateTimestamp: string;
  metadata?: {
    name: string;
    symbol: string;
    image: string;
  };
  // Add dummy field for demo purposes
  volume24h?: number;
}

// Helper function to generate dummy volume data
const addDummyVolume = (tokens: Token[]): Token[] => {
  return tokens.map((token, index) => ({
    ...token,
    volume24h: Math.random() * 10000000 + 100000 // Random volume between 100k-10M
  }));
};

// Helper function to format time since launch
const formatTimeSince = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return `${minutes}m ago`;
};

// Helper function to format volume/market cap
const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(0)}`;
};

// Token list item component
interface TokenItemProps {
  token: Token;
  metric: string;
  metricValue: string;
  onClick: () => void;
}

const TokenItem = ({ token, metric, metricValue, onClick }: TokenItemProps) => (
  <div 
    className="flex items-center justify-between p-3 hover:bg-white/5 transition-colors cursor-pointer"
    onClick={onClick}
  >
    <div className="flex items-center gap-3">
      {token.metadata?.image ? (
        <div className="relative w-10 h-10">
          <Image
            src={token.metadata.image}
            alt={token.metadata.name || "Token"}
            fill
            className="rounded-full object-cover"
          />
        </div>
      ) : (
        <div className="w-10 h-10 bg-white/10 rounded-full" />
      )}
      <div>
        <h3 className="text-white font-semibold text-sm">
          {token.metadata?.symbol || "UNKNOWN"}
        </h3>
        <p className="text-white/60 text-xs">
          {token.metadata?.name || "Unknown Token"}
        </p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-white/60 text-xs">{metric}</p>
      <p className="text-white font-semibold text-sm">{metricValue}</p>
    </div>
  </div>
);

export default function TokensTable() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchSolPrice() {
      try {
        const response = await fetch("/api/sol-price");
        const { price } = await response.json();
        setSolPrice(price);
      } catch (error) {
        console.error("Error fetching SOL price:", error);
      }
    }

    fetchSolPrice();
  }, []);

  useEffect(() => {
    async function fetchTokens() {
      try {
        const response = await fetch("/api/pools");
        const { pools } = await response.json();
        setTokens(addDummyVolume(pools));
      } catch (error) {
        console.error("Error fetching tokens:", error);
        setError("Failed to fetch tokens");
      } finally {
        setLoading(false);
      }
    }

    fetchTokens();
  }, []);

  const getMarketCap = (token: Token): number => {
    if (!solPrice) return 0;
    const reserves = {
      solReserve: Number(token.solReserve),
      effectiveSolReserve: Number(token.effectiveSolReserve),
      tokenReserve: Number(token.tokenReserve),
      effectiveTokenReserve: Number(token.effectiveTokenReserve),
      totalDeltaKLongs: Number(token.totalDeltaKLongs),
      totalDeltaKShorts: Number(token.totalDeltaKShorts),
      fundingConstantC: Number(token.fundingConstantC)
    };
    const marketCapStr = calculateTokenMarketCap(reserves, solPrice);
    // Parse the market cap string (remove $ and M/K suffixes)
    const numStr = marketCapStr.replace(/[$,]/g, '');
    if (numStr.includes('M')) {
      return parseFloat(numStr.replace('M', '')) * 1000000;
    } else if (numStr.includes('K')) {
      return parseFloat(numStr.replace('K', '')) * 1000;
    }
    return parseFloat(numStr) || 0;
  };

  if (loading) {
    return <div className="text-center py-8 text-white">Loading...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">{error}</div>;
  }

  // Sort tokens for each section
  const newTokens = [...tokens]
    .sort((a, b) => (Number(b.lastUpdateTimestamp) || 0) - (Number(a.lastUpdateTimestamp) || 0))
    .slice(0, 10);
    
  const trendingTokens = [...tokens]
    .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
    .slice(0, 10);
    
  const hallOfFameTokens = [...tokens]
    .sort((a, b) => getMarketCap(b) - getMarketCap(a))
    .slice(0, 10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* New Section */}
      <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
        <div className="p-4 border-b border-gray-700/50">
          <h2 className="text-xl font-bold text-white">🚀 New</h2>
          <p className="text-white/60 text-sm">Recently launched tokens</p>
        </div>
        <div className="divide-y divide-gray-700/30">
          {newTokens.map((token) => (
            <TokenItem
              key={token.address}
              token={token}
              metric="Launched"
              metricValue={formatTimeSince(Number(token.lastUpdateTimestamp) * 1000)}
              onClick={() => router.push(`/trade/${token.tokenMint}`)}
            />
          ))}
        </div>
      </div>

      {/* Trending Section */}
      <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
        <div className="p-4 border-b border-gray-700/50">
          <h2 className="text-xl font-bold text-white">🔥 Trending</h2>
          <p className="text-white/60 text-sm">Highest 24h volume</p>
        </div>
        <div className="divide-y divide-gray-700/30">
          {trendingTokens.map((token) => (
            <TokenItem
              key={token.address}
              token={token}
              metric="24h Volume"
              metricValue={formatCurrency(token.volume24h || 0)}
              onClick={() => router.push(`/trade/${token.tokenMint}`)}
            />
          ))}
        </div>
      </div>

      {/* Hall of Fame Section */}
      <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 overflow-hidden">
        <div className="p-4 border-b border-gray-700/50">
          <h2 className="text-xl font-bold text-white">👑 Hall of Fame</h2>
          <p className="text-white/60 text-sm">Highest market cap</p>
        </div>
        <div className="divide-y divide-gray-700/30">
          {hallOfFameTokens.map((token) => (
            <TokenItem
              key={token.address}
              token={token}
              metric="Market Cap"
              metricValue={formatCurrency(getMarketCap(token))}
              onClick={() => router.push(`/trade/${token.tokenMint}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
} 