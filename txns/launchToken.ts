import { 
  Transaction, 
  PublicKey, 
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
  Keypair,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createMint,
  createAssociatedTokenAccount,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';
import { getOptimalComputeUnits } from '@/utils/estimateComputeUnits';
import { connection } from '@/utils/connection';
import BN from 'bn.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { WalletContextState } from '@solana/wallet-adapter-react';
import IDL from '@/idl/facemelt.json';
import { Idl } from '@coral-xyz/anchor';

interface LaunchTokenParams {
  name: string;
  symbol: string;
  description: string;
  metadataUri: string;
  virtualSolReserve: number;
  wallet: WalletContextState;
}

export async function createLaunchTokenTransaction({
  name,
  symbol,
  description,
  metadataUri,
  virtualSolReserve,
  wallet
}: LaunchTokenParams): Promise<{ transaction: Transaction; mintKeypair: Keypair }> {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  // Create mint account
  const mintKeypair = Keypair.generate();
  console.log('Mint address:', mintKeypair.publicKey.toBase58());
  
  // Create pool PDA
  const [pool, poolBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), mintKeypair.publicKey.toBuffer()],
    new PublicKey('DjSx4kWjgjUQ2QDjYcfJooCNhisSC2Rk3uzGkK9fJRbb')
  );

  console.log('Pool address:', pool.toBase58());
  console.log('Pool bump:', poolBump);

  // Create token vault PDA (matching deploy script)
  const [tokenVault] = PublicKey.findProgramAddressSync(
    [
      pool.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mintKeypair.publicKey.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Create metadata PDA
  const [metadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mintKeypair.publicKey.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  // Create the transaction
  const transaction = new Transaction();

  // Create Anchor provider and program
  const anchorWallet = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
  } as Wallet;

  const provider = new AnchorProvider(connection, anchorWallet, {});
  const program = new Program(IDL as Idl, new PublicKey('DjSx4kWjgjUQ2QDjYcfJooCNhisSC2Rk3uzGkK9fJRbb'), provider);

  // Add launch instruction using Anchor
  const launchIx = await program.methods
    .launch(
      new BN(virtualSolReserve * LAMPORTS_PER_SOL),
      name,
      symbol,
      metadataUri
    )
    .accounts({
      authority: wallet.publicKey,
      tokenMint: mintKeypair.publicKey,
      pool,
      tokenVault,
      metadata,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    })
    .instruction();

  transaction.add(launchIx);

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

  return { transaction, mintKeypair };
} 