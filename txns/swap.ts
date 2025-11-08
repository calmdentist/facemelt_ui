import { 
  Transaction, 
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount
} from '@solana/spl-token';
import { getOptimalComputeUnits } from '@/utils/estimateComputeUnits';
import { connection } from '@/utils/connection';
import BN from 'bn.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { WalletContextState } from '@solana/wallet-adapter-react';
import IDL from '@/idl/facemelt.json';
import { Idl } from '@coral-xyz/anchor';

interface PoolAccount {
  authority: PublicKey;
  tokenMint: PublicKey;
  tokenVault: PublicKey;
  tokenReserve: BN;
  solReserve: BN;
  effectiveSolReserve: BN;
  effectiveTokenReserve: BN;
  totalDeltaKLongs: BN;
  totalDeltaKShorts: BN;
  cumulativeFundingAccumulator: BN;
  lastUpdateTimestamp: BN;
  emaPrice: BN;
  emaInitialized: boolean;
  fundingConstantC: BN;
  liquidationDivergenceThreshold: BN;
  bump: number;
}

interface SwapParams {
  pool: PublicKey;
  amountIn: number;
  minAmountOut: number;
  wallet: WalletContextState;
  isSolToTokenY: boolean; // true if swapping from SOL to token Y, false if swapping from token Y to SOL
}

interface LeverageSwapParams extends SwapParams {
  leverage: number;
  nonce: number;
}

interface ClosePositionParams {
  pool: PublicKey; // Pool PDA
  position: PublicKey; // Position account address
  wallet: WalletContextState;
}

export async function createSwapTransaction({
  pool,
  amountIn,
  minAmountOut,
  wallet,
  isSolToTokenY
}: SwapParams): Promise<Transaction> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  // Create Anchor provider and program
  const anchorWallet = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
  } as Wallet;

  const provider = new AnchorProvider(connection, anchorWallet, {});
  const program = new Program(IDL as Idl, new PublicKey('5cZM87xG3opyuDjBedCpxJ6mhDyztVXLEB18tcULCmmW'), provider);

  // Get pool data to determine token accounts
  const poolData = (await program.account.pool.fetch(pool)) as unknown as PoolAccount;
  const tokenMint = poolData.tokenMint;
  const tokenVault = poolData.tokenVault;

  // Set up token accounts based on swap direction
  let userTokenIn: PublicKey;
  let userTokenOut: PublicKey;

  if (isSolToTokenY) {
    // Swapping from SOL to token
    userTokenIn = wallet.publicKey; // SOL account is the wallet itself
    userTokenOut = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );
  } else {
    // Swapping from token to SOL
    userTokenIn = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );
    userTokenOut = wallet.publicKey; // SOL account is the wallet itself
  }

  // Create the transaction
  const transaction = new Transaction();

  // Check if token account exists and create it if it doesn't
  // Only need to check if we're receiving token (either as input or output)
  const tokenAccount = isSolToTokenY ? userTokenOut : userTokenIn;
  try {
    await getAccount(connection, tokenAccount);
  } catch (error) {
    // Account doesn't exist, create it
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        tokenAccount,
        wallet.publicKey,
        tokenMint
      )
    );
  }

  // Add swap instruction using Anchor
  const swapIx = await program.methods
    .swap(
      new BN(isSolToTokenY ? amountIn * LAMPORTS_PER_SOL : amountIn * Math.pow(10, 6)),
      // new BN(isSolToTokenY ? minAmountOut * Math.pow(10, 6) : minAmountOut * LAMPORTS_PER_SOL)
      new BN(0)
    )
    .accounts({
      user: wallet.publicKey,
      pool,
      tokenVault,
      userTokenIn,
      userTokenOut,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  transaction.add(swapIx);

  // Get optimal compute units
  let computeUnits = 500_000;
  try {
    computeUnits = await getOptimalComputeUnits(
      transaction.instructions,
      wallet.publicKey,
      []
    ) ?? 500_000;
  } catch (error) {
    console.error('Error getting optimal compute units:', error);
  }

  if (computeUnits) {
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnits,
      })
    );
  }

  // Add recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;
  transaction.lastValidBlockHeight = lastValidBlockHeight;

  return transaction;
}

export async function createLeverageSwapTransaction({
  pool,
  amountIn,
  minAmountOut,
  leverage,
  nonce,
  wallet,
  isSolToTokenY
}: LeverageSwapParams): Promise<Transaction> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  // Create Anchor provider and program
  const anchorWallet = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
  } as Wallet;

  const provider = new AnchorProvider(connection, anchorWallet, {});
  const program = new Program(IDL as Idl, new PublicKey('5cZM87xG3opyuDjBedCpxJ6mhDyztVXLEB18tcULCmmW'), provider);

  // Get pool data to determine token accounts
  const poolData = (await program.account.pool.fetch(pool)) as unknown as PoolAccount;
  const tokenMint = poolData.tokenMint;
  const tokenVault = poolData.tokenVault;

  // Set up token accounts based on swap direction
  let userTokenIn: PublicKey;

  if (isSolToTokenY) {
    // Swapping from SOL to token
    userTokenIn = wallet.publicKey; // SOL account is the wallet itself
  } else {
    // Swapping from token to SOL
    userTokenIn = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );
  }

  // Convert nonce to BN and get its bytes
  const nonceBN = new BN(nonce);
  const nonceBytes = nonceBN.toArrayLike(Buffer, "le", 8);

  // Derive position PDA with nonce
  const [position] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('position'),
      pool.toBuffer(),
      wallet.publicKey.toBuffer(),
      nonceBytes,
    ],
    new PublicKey('5cZM87xG3opyuDjBedCpxJ6mhDyztVXLEB18tcULCmmW')
  );

  // Create the transaction
  const transaction = new Transaction();

  // Check if token account exists and create it if it doesn't (only for non-SOL input)
  if (!isSolToTokenY) {
    try {
      await getAccount(connection, userTokenIn);
    } catch (error) {
      // Account doesn't exist, create it
      transaction.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userTokenIn,
          wallet.publicKey,
          tokenMint
        )
      );
    }
  }

  // Add leverage swap instruction using Anchor
  const leverageSwapIx = await program.methods
    .leverageSwap(
      new BN(Math.floor(amountIn * (isSolToTokenY ? LAMPORTS_PER_SOL : Math.pow(10, 6)))), // Use correct decimals for input
      new BN(0), // minAmountOut
      Math.floor(leverage), // Pass raw leverage value (2.0 becomes 2)
      nonceBN
    )
    .accounts({
      user: wallet.publicKey,
      pool,
      tokenVault,
      userTokenIn,
      position,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  transaction.add(leverageSwapIx);

  // Get optimal compute units
  let computeUnits = 500_000;
  try {
    computeUnits = await getOptimalComputeUnits(
      transaction.instructions,
      wallet.publicKey,
      []
    ) ?? 500_000;
  } catch (error) {
    console.error('Error getting optimal compute units:', error);
  }

  if (computeUnits) {
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnits,
      })
    );
  }

  // Add recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;
  transaction.lastValidBlockHeight = lastValidBlockHeight;

  return transaction;
}

export async function createClosePositionTransaction({
  pool,
  position,
  wallet,
}: ClosePositionParams): Promise<Transaction> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  // Create Anchor provider and program
  const anchorWallet = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
  } as Wallet;

  const provider = new AnchorProvider(connection, anchorWallet, {});
  const program = new Program(IDL as Idl, new PublicKey('5cZM87xG3opyuDjBedCpxJ6mhDyztVXLEB18tcULCmmW'), provider);

  // Fetch pool data directly using pool PDA provided
  const poolData = (await program.account.pool.fetch(pool)) as unknown as PoolAccount;
  const tokenMint = poolData.tokenMint;
  const tokenVault = poolData.tokenVault;

  // Get user's token account
  const userTokenOut = await getAssociatedTokenAddress(
    tokenMint,
    wallet.publicKey
  );

  // Create the transaction
  const transaction = new Transaction();

  // Check if user's token account exists and create it if it doesn't
  try {
    await getAccount(connection, userTokenOut);
  } catch (error) {
    // Account doesn't exist, create it
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userTokenOut,
        wallet.publicKey,
        tokenMint
      )
    );
  }

  // Add close position instruction using Anchor
  const closePositionIx = await program.methods
    .closePosition()
    .accounts({
      user: wallet.publicKey,
      pool,
      tokenVault,
      position,
      userTokenOut,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  transaction.add(closePositionIx);

  // Get optimal compute units
  let computeUnits = 500_000;
  try {
    computeUnits = await getOptimalComputeUnits(
      transaction.instructions,
      wallet.publicKey,
      []
    ) ?? 500_000;
  } catch (error) {
    console.error('Error getting optimal compute units:', error);
  }

  if (computeUnits) {
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnits,
      })
    );
  }

  // Add recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;
  transaction.lastValidBlockHeight = lastValidBlockHeight;

  return transaction;
} 