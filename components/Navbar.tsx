'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useActiveWallet } from '@/hooks/useActiveWallet';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { truncateAddress } from '@/utils/format';
import { Avatar } from '@/components/avatars/Avatar';
import SearchBar from './SearchBar';

export default function Navbar() {
  const { publicKey, connected, disconnect } = useActiveWallet();
  const { setVisible } = useWalletModal();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);

  // Close wallet menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (walletMenuRef.current && !walletMenuRef.current.contains(event.target as Node)) {
        setIsWalletMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="w-full py-2 px-6 border-b border-border flex items-center relative" style={{minHeight: '48px'}}>
      {/* Left: Logo and Menu */}
      <div className="flex items-center space-x-8 min-w-[260px] justify-start">
        <Link href="/" className="flex items-center space-x-2">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent font-mono">Facemelt</h1>
        </Link>
        <div className="hidden md:flex items-center space-x-8">
          <Link href="/trade" className="text-foreground hover:text-primary transition font-mono">
            Trade
          </Link>
          <Link href="/launch" className="text-foreground hover:text-primary transition font-mono">
            Launch
          </Link>
          <Link href="/docs" className="text-foreground hover:text-primary transition font-mono">
            Docs
          </Link>
        </div>
      </div>

      {/* Center: Search Bar (absolutely centered) */}
      <div className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md" style={{zIndex: 10}}>
        <SearchBar />
      </div>

      {/* Right: Wallet/Theme Controls */}
      <div className="flex items-center space-x-4 min-w-[260px] justify-end ml-auto">
        {connected && publicKey ? (
          <div className="relative" ref={walletMenuRef}>
            <button 
              onClick={() => setIsWalletMenuOpen(!isWalletMenuOpen)}
              className="flex items-center space-x-2 hover:opacity-80 transition p-2 rounded-full"
              style={{ height: 32, width: 'auto' }}
            >
              <Avatar publicKey={publicKey.toString()} size={32} />
              <span className="text-sm text-foreground font-mono">
                {truncateAddress(publicKey.toString())}
              </span>
            </button>

            {isWalletMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-card rounded-md shadow-lg py-1 z-50">
                <Link 
                  href={`/profile/${publicKey.toString()}`}
                  className="block px-4 py-2 text-sm text-foreground hover:bg-primary/10 transition"
                  onClick={() => setIsWalletMenuOpen(false)}
                >
                  View Profile
                </Link>
                <button
                  onClick={() => {
                    disconnect && disconnect();
                    setIsWalletMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-primary/10 transition"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        ) : (
          <button 
            className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition font-mono"
            onClick={() => setVisible(true)}
          >
            Connect Wallet
          </button>
        )}
        
        {/* Mobile menu button */}
        <button 
          className="md:hidden text-foreground"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="absolute top-16 right-0 left-0 bg-card p-4 md:hidden z-50 border-b border-border">
          <div className="flex flex-col space-y-4">
            <Link href="/trade" className="text-foreground hover:text-primary transition font-mono">
              Trade
            </Link>
            <Link href="/launch" className="text-foreground hover:text-primary transition font-mono">
              Launch
            </Link>
            <Link href="/docs" className="text-foreground hover:text-primary transition font-mono">
              Docs
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
} 