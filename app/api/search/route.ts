import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { fetchAllPools } from '../utils/fetchAllPools';

export const dynamic = "force-dynamic";

// Default tokens that should always be available
const DEFAULT_TOKENS = [
  {
    symbol: 'USDC',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    type: 'token' as const,
    metadata: {
      name: 'USD Coin',
      symbol: 'USDC',
      image: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=026',
    },
  },
  {
    symbol: 'SOL',
    address: 'So11111111111111111111111111111111111111112',
    type: 'token' as const,
    metadata: {
      name: 'Solana',
      symbol: 'SOL',
      image: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=026',
    },
  },
  {
    symbol: 'BONK',
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    type: 'token' as const,
    metadata: {
      name: 'Bonk',
      symbol: 'BONK',
      image: 'https://cryptologos.cc/logos/bonk-bonk-logo.png?v=026',
    },
  },
];

// Cache for pools data
let poolsCache: { tokenMint: string; metadata?: { name: string; symbol: string; image: string } }[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getPoolsData() {
  const now = Date.now();
  if (now - lastFetchTime > CACHE_DURATION) {
    try {
      // Use the fetchAllPools util directly
      const data = await fetchAllPools();
      poolsCache = data;
      lastFetchTime = now;
    } catch (error) {
      console.error('Error fetching pools:', error);
    }
  }
  return poolsCache;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json([]);
  }

  const searchQuery = query.toLowerCase();

  // Get pools data
  const pools = await getPoolsData();
  
  // Create a map of unique token addresses from pools with their metadata
  const poolTokens = new Map(
    pools.map(pool => [
      pool.tokenMint,
      {
        symbol: pool.metadata?.symbol || pool.tokenMint.slice(0, 4).toUpperCase(),
        address: pool.tokenMint,
        type: 'token' as const,
        metadata: pool.metadata,
      },
    ])
  );
  
  // Combine default tokens with pool tokens
  const allTokens = [
    ...DEFAULT_TOKENS,
    ...Array.from(poolTokens.values()),
  ];

  // Search in all tokens
  const tokenResults = allTokens.filter(token => 
    token.symbol.toLowerCase().includes(searchQuery) ||
    token.address.toLowerCase().includes(searchQuery) ||
    token.metadata?.name.toLowerCase().includes(searchQuery)
  );

  // If the query looks like a Solana address, try to validate it
  let addressResult = null;
  if (searchQuery.length >= 32 && searchQuery.length <= 44) {
    try {
      const pubkey = new PublicKey(searchQuery);
      addressResult = {
        type: 'address' as const,
        address: pubkey.toString(),
      };
    } catch (e) {
      // Invalid address, ignore
    }
  }

  // Combine results
  const results = [
    ...tokenResults,
    ...(addressResult ? [addressResult] : []),
  ];

  return NextResponse.json(results);
} 