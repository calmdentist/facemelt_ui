import dotenv from 'dotenv';

dotenv.config();

// RPC configuration
// export const RPC_URL = "https://christie-jbe1oy-fast-mainnet.helius-rpc.com";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8899";

// Facemelt program details
export const FACEMELT_PROGRAM_ID = "DjSx4kWjgjUQ2QDjYcfJooCNhisSC2Rk3uzGkK9fJRbb";
export const USDC_TOKEN_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Feature flags
export const MAX_LEVERAGE = 10; // Maximum leverage allowed
export const LIQUIDATION_THRESHOLD = 0.8; // 80% of collateral
export const TRADING_FEES = 0.003; // 0.3% fee

// UI constants
export const TOKEN_DECIMALS = 6; // Default for most Solana tokens
export const DEFAULT_SLIPPAGE = 0.01; // 1% slippage tolerance 