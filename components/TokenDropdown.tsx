'use client';

import { useState, useRef, useEffect } from 'react';
import { Avatar } from './avatars/Avatar';
import SearchBar from './SearchBar';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface TokenMetadata {
  symbol?: string;
  name?: string;
}

interface TokenDropdownProps {
  selected: string;
  onSelect: (mint: string) => void;
  metadata?: TokenMetadata;
}

export default function TokenDropdown({ selected, onSelect, metadata }: TokenDropdownProps) {
  const [open, setOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);

  // Update selectedSymbol when selected or metadata changes
  useEffect(() => {
    if (selected === 'So11111111111111111111111111111111111111112') {
      setSelectedSymbol('SOL');
    } else if (selected && metadata?.symbol) {
      setSelectedSymbol(metadata.symbol);
    } else if (selected) {
      setSelectedSymbol(selected.slice(0, 4) + '...');
    } else {
      setSelectedSymbol('Search token');
    }
  }, [selected, metadata]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && searchBarRef.current) {
      // Small delay to ensure the search bar is rendered
      setTimeout(() => {
        searchBarRef.current?.focus();
      }, 0);
    }
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="flex items-center gap-2 px-2 py-1 rounded-2xl bg-black hover:bg-white/5 cursor-pointer border border-white/10 transition"
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar publicKey={selected || 'search'} size={28} />
        {(!selected || selected === 'Search token') ? (
          <MagnifyingGlassIcon className="w-5 h-5 text-foreground" />
        ) : (
          <span className="font-mono text-lg text-foreground">{selectedSymbol}</span>
        )}
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" className="ml-1 text-foreground"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-64 bg-black border border-white/10 rounded-2xl shadow-xl">
          <div className="p-2">
            <div className="relative">
              <SearchBar
                ref={searchBarRef}
                onSelect={(result) => {
                  if (result.type === 'token' && result.address) {
                    onSelect(result.address);
                    setSelectedSymbol(result.symbol || result.address.slice(0, 4) + '...');
                    setOpen(false);
                  }
                }}
                className="mb-2"
                disableClickOutside
                placeholder="Search token"
              />
            </div>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              <button
                type="button"
                onClick={() => { 
                  onSelect('So11111111111111111111111111111111111111112'); 
                  setSelectedSymbol('SOL');
                  setOpen(false); 
                }}
                className="flex items-center gap-2 px-2 py-2 rounded hover:bg-white/5 cursor-pointer transition"
              >
                <Avatar publicKey="So11111111111111111111111111111111111111112" size={24} />
                <span className="text-foreground font-mono">SOL</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 