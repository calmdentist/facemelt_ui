import { PublicKey } from '@solana/web3.js';
import { Program, Idl } from '@coral-xyz/anchor';
import IDL from '@/idl/facemelt.json';
import { connection } from '@/utils/connection';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export interface PoolReserves {
  solReserve: number;
  effectiveSolReserve: number;
  tokenReserve: number;
  effectiveTokenReserve: number;
  totalDeltaKLongs: number;
  totalDeltaKShorts: number;
  fundingConstantC: number;
}

// Constants for decimals
const SOL_DECIMALS = 9;
const TOKEN_Y_DECIMALS = 6;
export const TOKEN_Y_SUPPLY = 1_000_000_000; // 1 billion tokens

export function calculatePoolPrice(reserves: PoolReserves): number {
  const { effectiveSolReserve, effectiveTokenReserve } = reserves;
  
  // Convert to human readable numbers - using effective reserves for pricing
  const effectiveSol = effectiveSolReserve / LAMPORTS_PER_SOL;
  const effectiveToken = effectiveTokenReserve / Math.pow(10, TOKEN_Y_DECIMALS);
  
  return effectiveSol / effectiveToken;
}

export function calculateRealReservesPrice(reserves: PoolReserves): number {
  const { solReserve, tokenReserve } = reserves;
  
  // Convert to human readable numbers
  const realSol = solReserve / LAMPORTS_PER_SOL;
  const realToken = tokenReserve / Math.pow(10, TOKEN_Y_DECIMALS);
  
  // Avoid division by zero
  if (realToken === 0) return 0;
  
  return realSol / realToken;
}

export function calculateRawMarketCap(reserves: PoolReserves, solPrice: number): number {
  const tokenYPrice = calculatePoolPrice(reserves);
  return TOKEN_Y_SUPPLY * tokenYPrice * solPrice;
}

export function calculateRawLiquidity(reserves: PoolReserves, solPrice: number): number {
  const { effectiveSolReserve } = reserves;
  const effectiveSol = effectiveSolReserve / LAMPORTS_PER_SOL;
  return effectiveSol * 2 * solPrice;
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
  const { effectiveSolReserve, effectiveTokenReserve } = reserves;
  
  // Convert input amount to raw units
  const rawInputAmount = isSolToTokenY 
    ? inputAmount * LAMPORTS_PER_SOL 
    : inputAmount * Math.pow(10, TOKEN_Y_DECIMALS);
  
  // Use effective reserves for calculations
  const x = isSolToTokenY ? effectiveSolReserve : effectiveTokenReserve;
  const y = isSolToTokenY ? effectiveTokenReserve : effectiveSolReserve;
  
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
  const program = new Program(IDL as Idl, new PublicKey('5cZM87xG3opyuDjBedCpxJ6mhDyztVXLEB18tcULCmmW'), {
    connection,
    publicKey: PublicKey.default
  });

  // Fetch pool data
  const poolAccount = await program.account.pool.fetch(poolAddress);
  
  return {
    solReserve: Number(poolAccount.solReserve),
    effectiveSolReserve: Number(poolAccount.effectiveSolReserve),
    tokenReserve: Number(poolAccount.tokenReserve),
    effectiveTokenReserve: Number(poolAccount.effectiveTokenReserve),
    totalDeltaKLongs: Number(poolAccount.totalDeltaKLongs),
    totalDeltaKShorts: Number(poolAccount.totalDeltaKShorts),
    fundingConstantC: Number(poolAccount.fundingConstantC)
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

/**
 * Calculate the LP funding rate based on the pool's leverage ratio
 * @param reserves Pool reserves
 * @returns Object containing funding rates per second, per day, and per annum (as percentages)
 */
export function calculateFundingRate(reserves: PoolReserves): {
  perSecond: number;
  perDay: number;
  perAnnum: number;
} {
  const { effectiveSolReserve, effectiveTokenReserve, totalDeltaKLongs, totalDeltaKShorts, fundingConstantC } = reserves;
  
  // Calculate k_e (effective constant product)
  const k_e = effectiveSolReserve * effectiveTokenReserve;
  
  // Calculate total delta k
  const totalDeltaK = totalDeltaKLongs + totalDeltaKShorts;
  
  // If no leverage positions, funding rate is 0
  if (totalDeltaK === 0 || k_e === 0) {
    return { perSecond: 0, perDay: 0, perAnnum: 0 };
  }
  
  // Calculate leverage ratio
  const leverageRatio = totalDeltaK / k_e;
  
  // Calculate funding rate: C * (leverageRatio)^2
  const fundingRatePerSecond = fundingConstantC * Math.pow(leverageRatio, 2);
  
  // Convert to percentage rates
  const perSecond = fundingRatePerSecond * 100;
  const perDay = perSecond * 86400; // 86400 seconds in a day
  const perAnnum = perDay * 365;
  
  return { perSecond, perDay, perAnnum };
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
  // For long: collateral in SOL, size in token
  // For short: collateral in token, size in SOL
  let output = 0;
  let collateralUsd = 0;
  let outputUsd = 0;
  if (isLong) {
    // Output: expectedOutput(size) - (collateral * (leverage - 1))
    // size is in token (raw, 6 decimals)
    // expectedOutput: token -> SOL
    const sizeToken = rawSize / Math.pow(10, TOKEN_Y_DECIMALS);
    const expectedSol = calculateExpectedOutput(reserves, sizeToken, false); // token -> SOL
    // Subtract borrowed amount (collateral * (leverage - 1)), collateral in SOL
    const borrowedSol = (rawCollateral / LAMPORTS_PER_SOL) * (leverage - 1);
    output = expectedSol - borrowedSol;
    // USD values
    outputUsd = output * solPrice;
    collateralUsd = (rawCollateral / LAMPORTS_PER_SOL) * solPrice;
  } else {
    // Output: expectedOutput(size) - (collateral * (leverage - 1))
    // size is in SOL (raw, 9 decimals)
    // expectedOutput: SOL -> token
    const sizeSol = rawSize / LAMPORTS_PER_SOL;
    const expectedToken = calculateExpectedOutput(reserves, sizeSol, true); // SOL -> token
    // Subtract borrowed amount (collateral * (leverage - 1)), collateral in token
    const borrowedToken = (rawCollateral / Math.pow(10, TOKEN_Y_DECIMALS)) * (leverage - 1);
    output = expectedToken - borrowedToken;
    // USD values
    outputUsd = output * calculatePoolPrice(reserves) * solPrice;
    collateralUsd = (rawCollateral / Math.pow(10, TOKEN_Y_DECIMALS)) * calculatePoolPrice(reserves) * solPrice;
  }
  if (collateralUsd === 0) return 0;
  return ((outputUsd - collateralUsd) / collateralUsd) * 100;
} 