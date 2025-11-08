import { PublicKey } from '@solana/web3.js';
import { Program, Idl } from '@coral-xyz/anchor';
import IDL from '@/idl/facemelt.json';
import { connection } from '@/utils/connection';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

interface PoolReserves {
  solReserve: number;
  virtualSolReserve: number;
  tokenYReserve: number;
  virtualTokenYReserve: number;
  leveragedSolAmount: number;
  leveragedTokenYAmount: number;
}

// Constants for decimals
const SOL_DECIMALS = 9;
const TOKEN_Y_DECIMALS = 6;
export const TOKEN_Y_SUPPLY = 1_000_000_000; // 1 billion tokens

export function calculatePoolPrice(reserves: PoolReserves): number {
  const { solReserve, virtualSolReserve, tokenYReserve, virtualTokenYReserve } = reserves;
  
  // Convert to human readable numbers
  const totalSol = (solReserve + virtualSolReserve) / LAMPORTS_PER_SOL;
  const totalTokenY = (tokenYReserve + virtualTokenYReserve) / Math.pow(10, TOKEN_Y_DECIMALS);
  
  return totalSol / totalTokenY;
}

export function calculateRealReservesPrice(reserves: PoolReserves): number {
  const { solReserve, tokenYReserve } = reserves;
  
  // Convert to human readable numbers
  const realSol = solReserve / LAMPORTS_PER_SOL;
  const realTokenY = tokenYReserve / Math.pow(10, TOKEN_Y_DECIMALS);
  
  // Avoid division by zero
  if (realTokenY === 0) return 0;
  
  return realSol / realTokenY;
}

export function calculateRawMarketCap(reserves: PoolReserves, solPrice: number): number {
  const tokenYPrice = calculatePoolPrice(reserves);
  return TOKEN_Y_SUPPLY * tokenYPrice * solPrice;
}

export function calculateRawLiquidity(reserves: PoolReserves, solPrice: number): number {
  const { solReserve, virtualSolReserve } = reserves;
  const totalSol = (solReserve + virtualSolReserve) / LAMPORTS_PER_SOL;
  return totalSol * 2 * solPrice;
}

export function formatNumber(value: number): string {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  } else {
    return `$${value.toFixed(2)}`;
  }
}

export function formatTokenAmount(value: number): string {
    if (value >= 1e9) {
      return `${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(2)}K`;
    } else {
      return `${value.toFixed(2)}`;
    }
  }

export function calculateMarketCap(reserves: PoolReserves, solPrice: number): string {
  const marketCap = calculateRawMarketCap(reserves, solPrice);
  return formatNumber(marketCap);
}

export function calculateLiquidity(reserves: PoolReserves, solPrice: number): string {
  const liquidity = calculateRawLiquidity(reserves, solPrice);
  return formatNumber(liquidity);
}

export function calculateExpectedOutput(
  reserves: PoolReserves,
  inputAmount: number,
  isSolToTokenY: boolean
): number {
  const { solReserve, virtualSolReserve, tokenYReserve, virtualTokenYReserve } = reserves;
  
  // Convert input amount to raw units
  const rawInputAmount = isSolToTokenY 
    ? inputAmount * LAMPORTS_PER_SOL 
    : inputAmount * Math.pow(10, TOKEN_Y_DECIMALS);
  
  // Use virtual reserves for calculations
  const x = isSolToTokenY ? solReserve + virtualSolReserve : tokenYReserve + virtualTokenYReserve;
  const y = isSolToTokenY ? tokenYReserve + virtualTokenYReserve : solReserve + virtualSolReserve;
  
  // Constant product formula: (x + Δx)(y - Δy) = xy
  // Solving for Δy: Δy = (y * Δx) / (x + Δx)
  const rawOutputAmount = (y * rawInputAmount) / (x + rawInputAmount);
  
  // Convert output back to human readable number
  return isSolToTokenY 
    ? rawOutputAmount / Math.pow(10, TOKEN_Y_DECIMALS)
    : rawOutputAmount / LAMPORTS_PER_SOL;
}

export async function getPoolReserves(
  poolAddress: PublicKey
): Promise<PoolReserves> {
  // Create program instance
  const program = new Program(IDL as Idl, new PublicKey('DjSx4kWjgjUQ2QDjYcfJooCNhisSC2Rk3uzGkK9fJRbb'), {
    connection,
    publicKey: PublicKey.default
  });

  // Fetch pool data
  const poolAccount = await program.account.pool.fetch(poolAddress);
  
  return {
    solReserve: Number(poolAccount.lamports),
    virtualSolReserve: Number(poolAccount.virtualSolAmount),
    tokenYReserve: Number(poolAccount.tokenYAmount),
    virtualTokenYReserve: Number(poolAccount.virtualTokenYAmount),
    leveragedSolAmount: Number(poolAccount.leveragedSolAmount),
    leveragedTokenYAmount: Number(poolAccount.leveragedTokenYAmount)
  };
}

export function calculatePositionEntryPrice(
  size: number,
  collateral: number,
  leverage: number,
  isLong: boolean,
  solPrice: number
): number {
  // Calculate the SOL/TOKEN rate at entry
  let entryRate: number;
  if (isLong) {
    // For long positions: (collateral * leverage) / size
    // collateral is in SOL (9 decimals), size is in TOKEN (6 decimals)
    // Need to adjust for decimal difference: 9 - 6 = 3 decimals
    entryRate = (collateral * leverage) / (size * Math.pow(10, 3));
  } else {
    // For short positions: size / (collateral * leverage)
    // size is in SOL (9 decimals), collateral is in TOKEN (6 decimals)
    // Need to adjust for decimal difference: 9 - 6 = 3 decimals
    entryRate = (size * Math.pow(10, 3)) / (collateral * leverage);
  }
  
  // Convert to USD by multiplying by SOL price
  return entryRate * solPrice;
}

export function calculatePositionPnL({
  isLong,
  rawSize,
  rawCollateral,
  leverage
}: {
  isLong: boolean,
  rawSize: number,
  rawCollateral: number,
  leverage: number
},
  reserves: PoolReserves,
  solPrice: number
): number {
  // Leverage is already scaled (not raw from contract)
  // For long: collateral in SOL, size in tokenY
  // For short: collateral in tokenY, size in SOL
  let output = 0;
  let collateralUsd = 0;
  let outputUsd = 0;
  if (isLong) {
    // Output: expectedOutput(size) - (collateral * (leverage - 1))
    // size is in tokenY (raw, 6 decimals)
    // expectedOutput: tokenY -> SOL
    const sizeTokenY = rawSize / Math.pow(10, TOKEN_Y_DECIMALS);
    const expectedSol = calculateExpectedOutput(reserves, sizeTokenY, false); // tokenY -> SOL
    // Subtract borrowed amount (collateral * (leverage - 1)), collateral in SOL
    const borrowedSol = (rawCollateral / LAMPORTS_PER_SOL) * (leverage - 1);
    output = expectedSol - borrowedSol;
    // USD values
    outputUsd = output * solPrice;
    collateralUsd = (rawCollateral / LAMPORTS_PER_SOL) * solPrice;
  } else {
    // Output: expectedOutput(size) - (collateral * (leverage - 1))
    // size is in SOL (raw, 9 decimals)
    // expectedOutput: SOL -> tokenY
    const sizeSol = rawSize / LAMPORTS_PER_SOL;
    const expectedTokenY = calculateExpectedOutput(reserves, sizeSol, true); // SOL -> tokenY
    // Subtract borrowed amount (collateral * (leverage - 1)), collateral in tokenY
    const borrowedTokenY = (rawCollateral / Math.pow(10, TOKEN_Y_DECIMALS)) * (leverage - 1);
    output = expectedTokenY - borrowedTokenY;
    // USD values
    outputUsd = output * calculatePoolPrice(reserves) * solPrice;
    collateralUsd = (rawCollateral / Math.pow(10, TOKEN_Y_DECIMALS)) * calculatePoolPrice(reserves) * solPrice;
  }
  if (collateralUsd === 0) return 0;
  return ((outputUsd - collateralUsd) / collateralUsd) * 100;
} 