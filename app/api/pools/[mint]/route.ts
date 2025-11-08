import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { RPC_URL } from "@/constants/constants";

export const dynamic = "force-dynamic";

const PROGRAM_ID = new PublicKey("5cZM87xG3opyuDjBedCpxJ6mhDyztVXLEB18tcULCmmW");

export async function GET(request: Request) {
  try {
    const { pathname } = new URL(request.url);
    // pathname will be like /api/pools/<mint>
    const parts = pathname.split("/");
    const mint = parts[parts.length - 1];

    const connection = new Connection(RPC_URL);
    const tokenYMint = new PublicKey(mint);

    // Fetch all program accounts of type Pool
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          dataSize: 72, // Size of Pool account
        },
        {
          memcmp: {
            offset: 40, // Offset to tokenYMint in Pool account
            bytes: tokenYMint.toBase58(),
          },
        },
      ],
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "Pool not found" },
        { status: 404 }
      );
    }

    const account = accounts[0];
    const data = account.account.data;

    const pool = {
      address: account.pubkey.toBase58(),
      authority: new PublicKey(data.slice(8, 40)).toBase58(),
      tokenYMint: new PublicKey(data.slice(40, 72)).toBase58(),
      tokenYVault: new PublicKey(data.slice(72, 104)).toBase58(),
      tokenYAmount: data.readBigUInt64LE(104).toString(),
      virtualTokenYAmount: data.readBigUInt64LE(112).toString(),
      lamports: data.readBigUInt64LE(120).toString(),
      virtualSolAmount: data.readBigUInt64LE(128).toString(),
    };

    return NextResponse.json({ pool });
  } catch (error) {
    console.error("Error fetching pool:", error);
    return NextResponse.json(
      { error: "Failed to fetch pool" },
      { status: 500 }
    );
  }
} 