'use client';

import { useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useConnection } from '@solana/wallet-adapter-react';
import { createLaunchTokenTransaction } from '@/txns/launchToken';
import { usePriorityFeeTransaction } from '@/hooks/usePriorityFeeTransaction';
import { showTransactionToast } from '@/utils/transactionToast';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import dynamic from 'next/dynamic';

// Create a client-side only wallet button component
const WalletButton = dynamic(
  () => Promise.resolve(() => (
    <div className="transform hover:scale-105 transition-all duration-300">
      <WalletMultiButton />
    </div>
  )),
  { ssr: false }
);

export default function LaunchPage() {
  const wallet = useActiveWallet();
  const [tokenName, setTokenName] = useState('');
  const [tokenTicker, setTokenTicker] = useState('');
  const [virtualLiquidity, setVirtualLiquidity] = useState('');
  const [tokenImage, setTokenImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [telegram, setTelegram] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { connection } = useConnection();
  const { sendTransactionWithPriorityFee } = usePriorityFeeTransaction();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
        toast.error('Please upload only PNG or JPG images');
        return;
      }
      setTokenImage(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      let metadataUri = '';
      if (tokenImage) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', tokenImage);
        uploadFormData.append('name', tokenName);
        uploadFormData.append('symbol', tokenTicker);
        uploadFormData.append('description', 'Token launched on Facemelt');
        uploadFormData.append('website', website);
        uploadFormData.append('twitter', twitter);
        uploadFormData.append('telegram', telegram);

        const response = await fetch('/api/upload-ipfs', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!response.ok) {
          throw new Error('Failed to upload image');
        }

        const data = await response.json();
        console.log("IPFS Upload Response:", data);

        if (data.error) {
          throw new Error(`Upload failed: ${data.error}`);
        }

        metadataUri = data.metadataUri;
        if (!metadataUri) {
          throw new Error('No metadata URI found in response');
        }
      }

      const { transaction, mintKeypair } = await createLaunchTokenTransaction({
        name: tokenName,
        symbol: tokenTicker,
        description: 'Token launched on Facemelt',
        metadataUri,
        virtualSolReserve: parseFloat(virtualLiquidity),
        wallet
      });

      const signature = await sendTransactionWithPriorityFee(transaction, mintKeypair);
      console.log("Transaction signature:", signature);

      const success = await showTransactionToast(signature, connection);
      
      if (success) {
        router.push('/');
      }
    } catch (error) {
      console.error("Full error:", error);
      toast.error("Error launching token", {
        description: error instanceof Error 
          ? `${error.message}\n${error.stack}` 
          : "Unknown error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-72px)] bg-black">
      <div className="flex flex-1 items-start justify-center pt-8" style={{ marginTop: '16px' }}>
        <div className="w-full max-w-lg p-0 shadow-none border-none bg-transparent">
          <h1 className="text-2xl font-bold font-mono mb-8 text-white">Launch Token</h1>
          
          {wallet.connected ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Image Upload */}
              <div className="bg-[#23242a] rounded-2xl p-6">
                <div className="flex flex-col items-center justify-center space-y-3 mb-4">
                  <div 
                    onClick={handleImageClick}
                    className="w-32 h-32 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 transform hover:scale-105 bg-[#181A20] border-2 border-[#35363c]"
                  >
                    {tokenImage ? (
                      <Image 
                        src={imagePreview || ''}
                        alt="Token image" 
                        width={128}
                        height={128}
                        className="object-cover rounded-full w-full h-full aspect-square"
                      />
                    ) : (
                      <div className="text-center text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-bold">Upload Image</span>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </div>
                  <p className="text-xs text-center text-[#b5b5b5] font-bold">
                    Recommended: 512x512px PNG or JPG
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm text-white font-bold font-mono">Token Name</label>
                    <input
                      type="text"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder="FunCoinName"
                      className="w-full p-2.5 bg-[#181A20] border-2 border-[#35363c] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00ffb3] focus:border-transparent font-mono text-base text-white transition-all"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="block text-sm text-white font-bold font-mono">Token Ticker</label>
                    <input
                      type="text"
                      value={tokenTicker}
                      onChange={(e) => setTokenTicker(e.target.value.toUpperCase())}
                      placeholder="FCN"
                      className="w-full p-2.5 bg-[#181A20] border-2 border-[#35363c] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00ffb3] focus:border-transparent font-mono text-base uppercase text-white transition-all"
                    />
                    <p className="text-xs text-[#b5b5b5] font-bold">
                      3-5 characters recommended, uppercase
                    </p>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="block text-sm text-white font-bold font-mono">Initial Virtual Liquidity (SOL)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={virtualLiquidity}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setVirtualLiquidity(value);
                        }}
                        placeholder="100"
                        className="w-full p-2.5 bg-[#181A20] border-2 border-[#35363c] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00ffb3] focus:border-transparent font-mono text-base pr-12 text-white transition-all"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white font-bold font-mono text-sm">SOL</div>
                    </div>
                    <p className="text-xs text-[#b5b5b5] font-bold">
                      Higher virtual liquidity = less price impact per trade
                    </p>
                  </div>

                  {/* Optional Fields Toggle */}
                  <div className="pt-4 border-t border-[#35363c]">
                    <button
                      type="button"
                      onClick={() => setShowOptional(!showOptional)}
                      className="flex items-center gap-2 text-[#b5b5b5] hover:text-white transition-colors font-mono text-sm"
                    >
                      {showOptional ? 'Hide' : 'Show'} more options
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        className={`transition-transform duration-200 ${showOptional ? 'rotate-180' : ''}`}
                      >
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </button>

                    {/* Optional Fields */}
                    {showOptional && (
                      <div className="space-y-4 mt-4">
                        <div className="space-y-1.5">
                          <label className="block text-sm text-white font-bold font-mono">Website (Optional)</label>
                          <input
                            type="url"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://yourwebsite.com"
                            className="w-full p-2.5 bg-[#181A20] border-2 border-[#35363c] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00ffb3] focus:border-transparent font-mono text-base text-white transition-all"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-sm text-white font-bold font-mono">Twitter (Optional)</label>
                          <input
                            type="text"
                            value={twitter}
                            onChange={(e) => setTwitter(e.target.value)}
                            placeholder="@yourtwitter"
                            className="w-full p-2.5 bg-[#181A20] border-2 border-[#35363c] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00ffb3] focus:border-transparent font-mono text-base text-white transition-all"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-sm text-white font-bold font-mono">Telegram (Optional)</label>
                          <input
                            type="text"
                            value={telegram}
                            onChange={(e) => setTelegram(e.target.value)}
                            placeholder="https://t.me/yourgroup"
                            className="w-full p-2.5 bg-[#181A20] border-2 border-[#35363c] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00ffb3] focus:border-transparent font-mono text-base text-white transition-all"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <a 
                  href="/docs/launch" 
                  className="text-[#00ffb3] hover:text-[#00d49c] font-mono text-sm transition-colors"
                >
                  How it works →
                </a>
              </div>
              
              <button
                type="submit"
                className="w-full p-4 rounded-2xl font-bold text-base transition-all duration-300 transform hover:scale-105 hover:shadow-lg font-mono bg-[#00ffb3] text-black cursor-pointer"
              >
                🚀 Launch Token 🚀
              </button>
            </form>
          ) : (
            <div className="p-8 flex flex-col items-center space-y-4 bg-[#23242a] rounded-2xl">
              <div className="text-center p-4 rounded-lg bg-[#181A20] border border-[#35363c]">
                <h2 className="text-xl font-bold mb-2 text-white">Ready to create the next big meme?</h2>
                <p className="text-base text-white font-mono mb-4">
                  Connect your wallet to launch a token
                </p>
                <WalletButton />
              </div>
              
              <div className="flex space-x-3 mt-4">
                <div className="w-2 h-2 rounded-full bg-[#00ffb3] animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-[#00ffb3] animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-[#00ffb3] animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 