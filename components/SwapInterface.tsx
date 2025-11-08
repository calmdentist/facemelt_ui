import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletIcon } from '@heroicons/react/24/outline';
import { MAX_LEVERAGE } from '@/constants/constants';
import TokenDropdown from '@/components/TokenDropdown';
import { getTokenBalances } from '@/utils/balance';
import { createSwapTransaction, createLeverageSwapTransaction } from '@/txns/swap';
import { usePriorityFeeTransaction } from '@/hooks/usePriorityFeeTransaction';
import { showTransactionToast } from '@/utils/transactionToast';
import { toast } from 'sonner';
import { calculateExpectedOutput, calculatePoolPrice, calculateRealReservesPrice, getPoolReserves, formatTokenAmount, calculateFundingRate } from '@/utils/poolCalculations';
import type { PoolReserves } from '@/utils/poolCalculations';
import PositionsPanel from './PositionsPanel';

interface TokenState {
  mint: string;
  metadata: {
    symbol?: string;
    name?: string;
  };
}

function BalanceChip({ token }: { token: TokenState }) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    if (!publicKey || !connection) return;

    if (token.mint === 'So11111111111111111111111111111111111111112') {
      // Function to fetch and set SOL balance
      const fetchSOLBalance = async () => {
        const balance = await connection.getBalance(publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      };

      fetchSOLBalance();

      // Subscribe to account changes
      const subscriptionId = connection.onAccountChange(
        publicKey,
        (accountInfo) => {
          setBalance(accountInfo.lamports / LAMPORTS_PER_SOL);
        },
        'confirmed'
      );

      return () => {
        connection.removeAccountChangeListener(subscriptionId);
      };
    } else {
      async function fetchBalance() {
        if (!publicKey) return;
        const balances = await getTokenBalances(publicKey.toString());
        const tokenBalance = balances.tokens.find(t => t.mint === token.mint);
        setBalance(tokenBalance?.amount || 0);
      }
      fetchBalance();
    }
  }, [publicKey, token.mint, connection]);

  return (
    <div className="text-xs px-2 py-1 rounded bg-[#1a1b20] text-[#b5b5b5] flex items-center gap-1">
      <WalletIcon className="w-3 h-3" />
      {balance.toFixed(4)}
    </div>
  );
}

interface SwapInterfaceProps {
  initialOutputToken?: string;
}

export default function SwapInterface({ initialOutputToken }: SwapInterfaceProps) {
  const wallet = useWallet();
  const [inputToken, setInputToken] = useState<TokenState>({
    mint: 'So11111111111111111111111111111111111111112',
    metadata: { symbol: 'SOL', name: 'Solana' }
  });
  const [outputToken, setOutputToken] = useState<TokenState>({
    mint: initialOutputToken || '',
    metadata: {}
  });
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [leverage, setLeverage] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const [isPositionsPanelOpen, setIsPositionsPanelOpen] = useState(false);
  const [solPrice, setSolPrice] = useState<number>(0);
  const { connection } = useConnection();
  const { sendTransactionWithPriorityFee } = usePriorityFeeTransaction();

  // Add state for pool reserves
  const [poolReserves, setPoolReserves] = useState<PoolReserves | null>(null);

  // Fetch SOL price
  useEffect(() => {
    async function fetchSolPrice() {
      try {
        const response = await fetch('/api/sol-price');
        if (!response.ok) throw new Error('Failed to fetch SOL price');
        const data = await response.json();
        setSolPrice(data.price);
      } catch (error) {
        console.error('Error fetching SOL price:', error);
        toast.error('Failed to fetch SOL price');
      }
    }

    fetchSolPrice();
    // Refresh price every minute
    const interval = setInterval(fetchSolPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  // Update output token when initialOutputToken changes
  useEffect(() => {
    if (initialOutputToken) {
      fetchTokenMetadata(initialOutputToken, false);
    }
  }, [initialOutputToken]);

  // Fetch token metadata when needed
  async function fetchTokenMetadata(mint: string, isInput: boolean) {
    if (!mint || mint === 'So11111111111111111111111111111111111111112') {
      if (isInput) {
        setInputToken({
          mint: 'So11111111111111111111111111111111111111112',
          metadata: { symbol: 'SOL', name: 'Solana' }
        });
      } else {
        setOutputToken({
          mint: 'So11111111111111111111111111111111111111112',
          metadata: { symbol: 'SOL', name: 'Solana' }
        });
      }
      return;
    }

    try {
      const response = await fetch(`/api/pools?tokenMint=${mint}`);
      if (!response.ok) throw new Error('Failed to fetch token metadata');
      const data = await response.json();
      if (isInput) {
        setInputToken({ mint, metadata: data.metadata || {} });
      } else {
        setOutputToken({ mint, metadata: data.metadata || {} });
      }
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      if (isInput) {
        setInputToken({ mint, metadata: {} });
      } else {
        setOutputToken({ mint, metadata: {} });
      }
    }
  }

  const handleSwitchTokens = () => {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
    setInputAmount(outputAmount);
    setOutputAmount(inputAmount);
  };

  // Helper function to get token symbol
  const getTokenSymbol = (token: TokenState) => {
    if (token.mint === 'So11111111111111111111111111111111111111112') return 'SOL';
    return token.metadata.symbol || token.mint.slice(0, 4) + '...';
  };

  const inputTokenSymbol = getTokenSymbol(inputToken);
  const outputTokenSymbol = outputToken.mint ? getTokenSymbol(outputToken) : '';

  // Fetch pool address when output token changes
  useEffect(() => {
    async function fetchPoolAddress() {
      if (!outputToken.mint) {
        setPoolAddress(null);
        return;
      }

      // If output token is SOL, we need to use the input token to find the pool
      const tokenMint = outputToken.mint === 'So11111111111111111111111111111111111111112' 
        ? inputToken.mint 
        : outputToken.mint;

      try {
        const response = await fetch(`/api/pools?tokenMint=${tokenMint}`);
        if (!response.ok) {
          throw new Error('Failed to fetch pool address');
        }
        const data = await response.json();
        setPoolAddress(data.pool);
      } catch (error) {
        console.error('Error fetching pool address:', error);
        setPoolAddress(null);
      }
    }

    fetchPoolAddress();
  }, [outputToken.mint, inputToken.mint]);

  // Fetch pool reserves when pool address changes
  useEffect(() => {
    async function fetchPoolReserves() {
      if (!poolAddress) {
        setPoolReserves(null);
        return;
      }

      try {
        const reserves = await getPoolReserves(new PublicKey(poolAddress));
        setPoolReserves(reserves);
      } catch (error) {
        console.error('Error fetching pool reserves:', error);
        setPoolReserves(null);
      }
    }

    fetchPoolReserves();
  }, [poolAddress]);

  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.connected || !wallet.publicKey || !inputAmount || !outputAmount || !poolAddress) return;

    setIsLoading(true);
    try {
      // Calculate minimum output amount based on slippage
      const minAmountOut = Number(outputAmount) * (1 - slippage / 100);

      // Determine if we're swapping from SOL to token Y
      const isSolToTokenY = inputToken.mint === 'So11111111111111111111111111111111111111112';

      let signature;
      if (leverage === 1.0) {
        // Regular swap
        const transaction = await createSwapTransaction({
          pool: new PublicKey(poolAddress),
          amountIn: Number(inputAmount),
          minAmountOut,
          wallet,
          isSolToTokenY
        });
        signature = await sendTransactionWithPriorityFee(transaction);
      } else {
        // Generate a random nonce for leverage swap
        const nonce = Math.floor(Math.random() * 1000000); // Use smaller range for nonce like in test file
        
        // Leveraged swap
        const transaction = await createLeverageSwapTransaction({
          pool: new PublicKey(poolAddress),
          amountIn: Number(inputAmount),
          minAmountOut: Math.floor(minAmountOut), // Ensure it's a whole number
          leverage: Math.floor(leverage * 10), // Scale by 10 for contract
          nonce, // Pass the generated nonce
          wallet,
          isSolToTokenY
        });
        signature = await sendTransactionWithPriorityFee(transaction);
      }

      const success = await showTransactionToast(signature, connection);
      if (success) {
        // Reset form
        setInputAmount('');
        setOutputAmount('');
        toast.success('Swap successful!');
      }
    } catch (error) {
      console.error('Swap error:', error);
      toast.error('Swap failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setInputAmount(value);
    calculateAndSetOutput(value);
  };

  const calculateAndSetOutput = (input: string) => {
    if (!input || isNaN(Number(input)) || !poolReserves) return '';
    
    const isSolToTokenY = inputToken.mint === 'So11111111111111111111111111111111111111112';
    const inputAmount = Number(input);
    
    // For leverage trades, multiply input by leverage
    const effectiveInput = leverage > 1.0 ? inputAmount * leverage : inputAmount;
    
    const outputAmount = calculateExpectedOutput(
      poolReserves,
      effectiveInput,
      isSolToTokenY
    );
    // Use outputToken.mint to determine decimals for formatting
    const isOutputSOL = outputToken.mint === 'So11111111111111111111111111111111111111112';
    setOutputAmount(outputAmount.toFixed(isOutputSOL ? 4 : 2));
  };

  // Add effect to recalculate output when leverage changes
  useEffect(() => {
    if (inputAmount) {
      calculateAndSetOutput(inputAmount);
    }
  }, [leverage, poolReserves, inputToken.mint]);

  // Helper to get the user's balance for the input token
  async function getInputTokenBalance() {
    if (!wallet.publicKey) return 0;
    const balances = await getTokenBalances(wallet.publicKey.toString());
    if (inputToken.mint === 'So11111111111111111111111111111111111111112') {
      return balances.SOL;
    } else {
      const tokenBalance = balances.tokens.find(t => t.mint === inputToken.mint);
      return tokenBalance?.amount || 0;
    }
  }

  const handleMax = async () => {
    const balance = await getInputTokenBalance();
    let safeBalance;
    if (inputToken.mint === 'So11111111111111111111111111111111111111112') {
      // For SOL, subtract 0.001
      safeBalance = Math.max(balance - 0.001, 0);
    } else {
      // For SPL tokens, subtract a small buffer (e.g., 0.000001 for 6 decimals)
      safeBalance = Math.max(balance - 0.000001, 0);
    }
    handleInputChange(safeBalance.toString());
  };

  const handleHalf = async () => {
    const balance = await getInputTokenBalance();
    const half = balance / 2;
    handleInputChange(half.toString());
  };

  // Calculate current price using real reserves only
  const currentPrice = poolReserves ? calculateRealReservesPrice(poolReserves) : 0;
  const displayPrice = inputTokenSymbol === 'SOL' ? currentPrice : 1 / currentPrice;

  // Helper to format token amount for display
  function formatDisplayTokenAmount(amount: string): string {
    if (!amount) return '';
    const digitCount = amount.replace('.', '').length;
    if (digitCount > 9) {
      return formatTokenAmount(Number(amount));
    }
    return amount;
  }

  return (
    <form onSubmit={handleSwap} className="space-y-0">
      {/* Input */}
      <div className="relative bg-[#23242a] rounded-2xl px-5 py-2 pb-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-white font-mono text-sm">Selling</span>
          <div className="flex gap-2 items-center">
            <BalanceChip token={inputToken} />
            <button type="button" onClick={handleHalf} className="text-xs px-2 py-1 rounded bg-[#1a1b20] text-[#b5b5b5] hover:bg-[#23242a]">HALF</button>
            <button type="button" onClick={handleMax} className="text-xs px-2 py-1 rounded bg-[#1a1b20] text-[#b5b5b5] hover:bg-[#23242a]">MAX</button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <TokenDropdown 
            selected={inputToken.mint} 
            onSelect={(mint) => fetchTokenMetadata(mint, true)} 
            metadata={inputToken.metadata} 
          />
          <div className="flex flex-col items-end">
            <input
              type="text"
              value={formatDisplayTokenAmount(inputAmount)}
              onChange={(e) => handleInputChange(e.target.value)}
              className="w-48 bg-transparent text-3xl font-mono text-white outline-none placeholder:text-[#555] text-right overflow-hidden text-ellipsis whitespace-nowrap"
              placeholder="0.00"
            />
            <div className="text-xs text-[#b5b5b5] font-mono">
              ${inputAmount && !isNaN(Number(inputAmount)) ? (
                Number(inputAmount) * (
                  inputTokenSymbol === 'SOL'
                    ? solPrice
                    : (poolReserves ? calculateRealReservesPrice(poolReserves) * solPrice : 0)
                )
              ).toFixed(2) : '0.00'}
            </div>
          </div>
        </div>
      </div>

      {/* Switch button */}
      <div className="flex justify-center relative z-30" style={{ marginTop: '-18px', marginBottom: '-18px' }}>
        <button
          type="button"
          onClick={handleSwitchTokens}
          className="bg-[#23242a] border-4 border-black rounded-full p-2 hover:bg-[#35363c] transition-colors shadow-lg relative z-30"
          aria-label="Switch tokens"
          style={{ boxShadow: '0 2px 12px 0 #0008' }}
        >
          <svg width="21" height="22" viewBox="0 0 21 22" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.51043 7.47998V14.99H7.77043V7.47998L9.66043 9.36998L10.5505 8.47994L7.5859 5.51453C7.3398 5.26925 6.94114 5.26925 6.69504 5.51453L3.73047 8.47994L4.62051 9.36998L6.51043 7.47998Z" fill="currentColor"></path>
            <path d="M14.4902 14.52V7.01001H13.2302V14.52L11.3402 12.63L10.4502 13.5201L13.4148 16.4855C13.6609 16.7308 14.0595 16.7308 14.3056 16.4855L17.2702 13.5201L16.3802 12.63L14.4902 14.52Z" fill="currentColor"></path>
          </svg>
        </button>
      </div>

      {/* Output */}
      <div className="bg-[#23242a] rounded-2xl px-5 py-2 pb-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-white font-mono text-sm">Buying</span>
        </div>
        <div className="flex items-center justify-between">
          <TokenDropdown 
            selected={outputToken.mint || 'Search token'} 
            onSelect={(mint) => fetchTokenMetadata(mint, false)} 
            metadata={outputToken.metadata} 
          />
          <div className="flex flex-col items-end">
            <input
              type="text"
              value={formatDisplayTokenAmount(outputAmount)}
              readOnly
              className="w-48 bg-transparent text-3xl font-mono text-white outline-none placeholder:text-[#555] text-right overflow-hidden text-ellipsis whitespace-nowrap"
              placeholder="0.00"
            />
            <div className="text-xs text-[#b5b5b5] font-mono">
              ${outputAmount && !isNaN(Number(outputAmount)) ? 
                (outputTokenSymbol === 'SOL' ? 
                  (Number(outputAmount) * solPrice).toFixed(2) : 
                  (Number(outputAmount) * calculateRealReservesPrice(poolReserves!) * solPrice).toFixed(2)
                ) : '0.00'}
            </div>
          </div>
        </div>
      </div>

      {/* Add vertical space before leverage */}
      <div style={{ marginTop: '18px' }} />

      {/* Leverage Slider */}
      <div className="flex flex-col gap-1 bg-[#23242a] rounded-2xl p-5">
        <div className="flex justify-between items-center mb-1">
          <span className="font-mono text-sm text-white">Leverage</span>
          <span className="font-mono text-sm text-white">{leverage.toFixed(1)}x{leverage === 1.0 ? ' (spot)' : ''}</span>
        </div>
        <div className="mb-1" />
        <input
          type="range"
          min={1}
          max={MAX_LEVERAGE}
          step={0.1}
          value={leverage}
          onChange={e => setLeverage(Number(e.target.value))}
          className="w-full leverage-slider"
          style={{
            background: `linear-gradient(to right, #00ffb3 ${(100 * (leverage - 1) / (MAX_LEVERAGE - 1)).toFixed(1)}%, #35363c ${(100 * (leverage - 1) / (MAX_LEVERAGE - 1)).toFixed(1)}%)`
          }}
        />
      </div>

      {/* Add vertical space before info row */}
      <div style={{ marginTop: '18px' }} />

      {/* Info Row */}
      <div className="flex justify-between items-center text-xs font-mono text-[#b5b5b5] px-2">
        <span>Rate: <span className="text-white">1 {inputTokenSymbol} = {displayPrice.toFixed(4)} {outputTokenSymbol}</span></span>
        <span>Impact: <span className="text-[#00ffb3]">0.1%</span></span>
        <span>Fee: <span className="text-white">~$0.01</span></span>
      </div>

      {/* Reserves Info */}
      {poolReserves && (
        <div className="text-xs font-mono text-[#b5b5b5] px-2 mt-4 space-y-1">
          <div className="flex justify-between items-center">
            <span>SOL Reserves (real / effective):</span>
            <span className="text-white">
              {formatTokenAmount(poolReserves.solReserve / LAMPORTS_PER_SOL)} / {formatTokenAmount(poolReserves.effectiveSolReserve / LAMPORTS_PER_SOL)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>{outputTokenSymbol} Reserves (real / effective):</span>
            <span className="text-white">
              {formatTokenAmount(poolReserves.tokenReserve / 1e6)} / {formatTokenAmount(poolReserves.effectiveTokenReserve / 1e6)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>Total Debt (Longs / Shorts):</span>
            <span className="text-white">
              {formatTokenAmount(poolReserves.totalDeltaKLongs / 1e18)} / {formatTokenAmount(poolReserves.totalDeltaKShorts / 1e18)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>LP Funding Rate:</span>
            <span className="text-[#00ffb3]">
              {(() => {
                const fundingRate = calculateFundingRate(poolReserves);
                return `${fundingRate.perDay.toFixed(4)}% / day (${fundingRate.perAnnum.toFixed(2)}% / year)`;
              })()}
            </span>
          </div>
        </div>
      )}

      {/* Add vertical space before buttons */}
      <div style={{ marginTop: '18px' }} />

      {/* Swap Button */}
      <button
        type="submit"
        disabled={!inputAmount || !outputAmount || isLoading || !poolAddress}
        className="w-full p-4 bg-[#00ffb3] text-black rounded-2xl font-bold font-mono text-lg hover:bg-[#00d49c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {isLoading ? 'Swapping...' : !poolAddress ? 'Pool not found' : 'Swap'}
      </button>

      {/* Manage Positions Button */}
      {poolAddress && (
        <button
          type="button"
          onClick={() => setIsPositionsPanelOpen(true)}
          className="w-full p-4 mt-4 bg-[#1a1b20] text-white rounded-2xl font-bold font-mono text-lg hover:bg-[#23242a] transition-colors cursor-pointer"
        >
          Manage Positions
        </button>
      )}

      {/* Positions Panel */}
      <PositionsPanel
        isOpen={isPositionsPanelOpen}
        onClose={() => setIsPositionsPanelOpen(false)}
        tokenYMint={inputToken.mint === 'So11111111111111111111111111111111111111112' ? outputToken.mint : inputToken.mint}
      />
    </form>
  );
} 