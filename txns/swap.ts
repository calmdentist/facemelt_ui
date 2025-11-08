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
  tokenYMint: PublicKey;
  tokenYVault: PublicKey;
  tokenYAmount: BN;
  virtualTokenYAmount: BN;
  lamports: BN;
  virtualSolAmount: BN;
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
  const program = new Program(IDL as Idl, new PublicKey('DjSx4kWjgjUQ2QDjYcfJooCNhisSC2Rk3uzGkK9fJRbb'), provider);

  // Get pool data to determine token accounts
  const poolData = (await program.account.pool.fetch(pool)) as unknown as PoolAccount;
  const tokenYMint = poolData.tokenYMint;
  const tokenYVault = poolData.tokenYVault;

  // Set up token accounts based on swap direction
  let userTokenIn: PublicKey;
  let userTokenOut: PublicKey;

  if (isSolToTokenY) {
    // Swapping from SOL to token Y
    userTokenIn = wallet.publicKey; // SOL account is the wallet itself
    userTokenOut = await getAssociatedTokenAddress(
      tokenYMint,
      wallet.publicKey
    );
  } else {
    // Swapping from token Y to SOL
    userTokenIn = await getAssociatedTokenAddress(
      tokenYMint,
      wallet.publicKey
    );
    userTokenOut = wallet.publicKey; // SOL account is the wallet itself
  }

  // Create the transaction
  const transaction = new Transaction();

  // Check if token Y account exists and create it if it doesn't
  // Only need to check if we're receiving token Y (either as input or output)
  const tokenYAccount = isSolToTokenY ? userTokenOut : userTokenIn;
  try {
    await getAccount(connection, tokenYAccount);
  } catch (error) {
    // Account doesn't exist, create it
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        tokenYAccount,
        wallet.publicKey,
        tokenYMint
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
      tokenYVault,
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
  const program = new Program(IDL as Idl, new PublicKey('DjSx4kWjgjUQ2QDjYcfJooCNhisSC2Rk3uzGkK9fJRbb'), provider);

  // Get pool data to determine token accounts
  const poolData = (await program.account.pool.fetch(pool)) as unknown as PoolAccount;
  const tokenYMint = poolData.tokenYMint;
  const tokenYVault = poolData.tokenYVault;

  // Set up token accounts based on swap direction
  let userTokenIn: PublicKey;
  let userTokenOut: PublicKey;

  if (isSolToTokenY) {
    // Swapping from SOL to token Y
    userTokenIn = wallet.publicKey; // SOL account is the wallet itself
    userTokenOut = await getAssociatedTokenAddress(
      tokenYMint,
      wallet.publicKey
    );
  } else {
    // Swapping from token Y to SOL
    userTokenIn = await getAssociatedTokenAddress(
      tokenYMint,
      wallet.publicKey
    );
    userTokenOut = wallet.publicKey; // SOL account is the wallet itself
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
    new PublicKey('DjSx4kWjgjUQ2QDjYcfJooCNhisSC2Rk3uzGkK9fJRbb')
  );

  // Derive associated token account for the position PDA
  const positionTokenAccount = await getAssociatedTokenAddress(
    tokenYMint,
    position,
    true // allowOwnerOffCurve
  );

  // Create the transaction
  const transaction = new Transaction();

  // Check if token Y account exists and create it if it doesn't
  // Only need to check if we're receiving token Y (either as input or output)
  const tokenYAccount = isSolToTokenY ? userTokenOut : userTokenIn;
  try {
    await getAccount(connection, tokenYAccount);
  } catch (error) {
    // Account doesn't exist, create it
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        tokenYAccount,
        wallet.publicKey,
        tokenYMint
      )
    );
  }

  // Add leverage swap instruction using Anchor
  const leverageSwapIx = await program.methods
    .leverageSwap(
      new BN(Math.floor(amountIn * (isSolToTokenY ? LAMPORTS_PER_SOL : Math.pow(10, 6)))), // Use correct decimals for input
      // new BN(Math.floor(minAmountOut * (isSolToTokenY ? Math.pow(10, 6) : LAMPORTS_PER_SOL))), // Use correct decimals for output
      new BN(0),
      Math.floor(leverage), // Pass raw leverage value (2.0 becomes 2)
      nonceBN
    )
    .accounts({
      user: wallet.publicKey,
      pool,
      tokenYVault,
      userTokenIn,
      userTokenOut,
      position,
      positionTokenAccount,
      positionTokenMint: tokenYMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
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
  const program = new Program(IDL as Idl, new PublicKey('DjSx4kWjgjUQ2QDjYcfJooCNhisSC2Rk3uzGkK9fJRbb'), provider);

  // Fetch pool data directly using pool PDA provided
  const poolData = (await program.account.pool.fetch(pool)) as unknown as PoolAccount;
  const tokenYMint = poolData.tokenYMint;
  const tokenYVault = poolData.tokenYVault;

  // Derive associated token account for the position PDA
  const positionTokenAccount = await getAssociatedTokenAddress(
    tokenYMint,
    position,
    true // allowOwnerOffCurve
  );

  // Get user's token account
  const userTokenOut = await getAssociatedTokenAddress(
    tokenYMint,
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
        tokenYMint
      )
    );
  }

  // Add close position instruction using Anchor
  const closePositionIx = await program.methods
    .closePosition()
    .accounts({
      user: wallet.publicKey,
      pool,
      tokenYVault,
      position,
      positionTokenAccount,
      userTokenOut,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
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