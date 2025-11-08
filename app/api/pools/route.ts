import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Idl, ProgramAccount } from "@coral-xyz/anchor";
import { NextResponse } from "next/server";
import { RPC_URL, FACEMELT_PROGRAM_ID } from "@/constants/constants";
import IDL from "@/idl/facemelt.json";
import { Metaplex } from "@metaplex-foundation/js";
import { Wallet } from '@coral-xyz/anchor';
import { connection } from '@/utils/connection';
import { fetchAllPools } from '../utils/fetchAllPools';

export const dynamic = "force-dynamic";

interface Pool {
  address: string;
  authority: string;
  tokenYMint: string;
  tokenYVault: string;
  tokenYAmount: string;
  virtualTokenYAmount: string;
  lamports: string;
  virtualSolAmount: string;
  creationTimestamp: string;
  metadata?: {
    name: string;
    symbol: string;
    image: string;
  };
}

// Cache for metadata
const metadataCache = new Map<string, { name: string; symbol: string; image: string }>();
let lastMetadataFetchTime = 0;
const METADATA_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function getTokenMetadata(connection: Connection, mintAddress: string) {
  const now = Date.now();
  if (metadataCache.has(mintAddress) && now - lastMetadataFetchTime < METADATA_CACHE_DURATION) {
    return metadataCache.get(mintAddress);
  }

  try {
    const metaplex = new Metaplex(connection);
    const metadata = await metaplex
      .nfts()
      .findByMint({ mintAddress: new PublicKey(mintAddress) });

    const metadataInfo = {
      name: metadata.name,
      symbol: metadata.symbol,
      image: metadata.json?.image || "",
    };

    metadataCache.set(mintAddress, metadataInfo);
    lastMetadataFetchTime = now;
    return metadataInfo;
  } catch (error) {
    console.error(`Error fetching metadata for ${mintAddress}:`, error);
    return undefined;
  }
}


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenMint = searchParams.get('tokenMint');

    if (!tokenMint) {
      // If no tokenMint is provided, return all pools
      const pools = await fetchAllPools();
      return NextResponse.json({ pools });
    }

    // Handle SOL token specially
    if (tokenMint === 'So11111111111111111111111111111111111111112') {
      return NextResponse.json({ 
        pool: null,
        metadata: {
          name: 'Solana',
          symbol: 'SOL',
          image: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=026'
        }
      });
    }

    // Validate the token mint address
    try {
      new PublicKey(tokenMint);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token mint address' }, { status: 400 });
    }

    // Create Anchor provider and program
    const provider = new AnchorProvider(connection, {} as Wallet, {});
    const program = new Program(IDL as Idl, new PublicKey(FACEMELT_PROGRAM_ID), provider);

    // Find pool PDA
    const [pool] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), new PublicKey(tokenMint).toBuffer()],
      program.programId
    );

    // Verify pool exists
    try {
      await program.account.pool.fetch(pool);
    } catch (error) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Fetch token metadata
    const metadata = await getTokenMetadata(connection, tokenMint);

    // Calculate price
    const poolAccount = await program.account.pool.fetch(pool);
    const solReserve = Number(poolAccount.lamports);
    const virtualSolReserve = Number(poolAccount.virtualSolAmount);
    const tokenYReserve = Number(poolAccount.tokenYAmount);
    const virtualTokenYReserve = Number(poolAccount.virtualTokenYAmount);
    const leveragedSolAmount = Number(poolAccount.leveragedSolAmount);
    const leveragedTokenYAmount = Number(poolAccount.leveragedTokenYAmount);
    
    const price = (solReserve + virtualSolReserve) / (tokenYReserve + virtualTokenYReserve);

    return NextResponse.json({ 
      pool: pool.toBase58(),
      metadata,
      price,
      solReserve,
      virtualSolReserve,
      tokenYReserve,
      virtualTokenYReserve,
      leveragedSolAmount,
      leveragedTokenYAmount
    });
  } catch (error) {
    console.error('Error fetching pool:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch pool' },
      { status: 500 }
    );
  }
} 