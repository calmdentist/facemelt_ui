'use client';

import { useState } from 'react';
import Link from 'next/link';

type DocSection = {
  id: string;
  title: string;
  content: React.ReactNode;
};

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('introduction');

  const sections: DocSection[] = [
    {
      id: 'introduction',
      title: 'Introduction',
      content: (
        <div className="space-y-4">
          <p>
            Facemelt is a novel automated market maker (AMM) designed specifically for the memecoin market. 
            It makes an already volatile asset class even more volatile by combining spot and leverage trading 
            within a unified liquidity framework, requiring zero seed capital for new token launches.
          </p>
          <p>
            By employing the Uniswap V2 style invariant with modifications to accommodate leveraged positions,
            Facemelt enables a novel trading experience while ensuring the underlying AMM remains solvent at all times.
          </p>
        </div>
      ),
    },
    {
      id: 'mathematical-foundation',
      title: 'Mathematical Foundation',
      content: (
        <div className="space-y-4">
          <p>
            At the core of Facemelt is a modified Uniswap V2 style AMM with the constant product invariant:
          </p>
          <div className="p-4 bg-secondary/40 rounded-lg text-center font-mono">
            x · y = k
          </div>
          <p>where:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>x represents the reserve of the base asset (stablecoin or SOL)</li>
            <li>y represents the reserve of the memecoin token</li>
            <li>k is a constant value maintained during spot trading</li>
          </ul>
          <p>
            Unlike traditional AMMs, Facemelt introduces modifications to accommodate leveraged trading and zero seed capital token launches.
          </p>
        </div>
      ),
    },
    {
      id: 'token-launch',
      title: 'Token Launch Mechanism',
      content: (
        <div className="space-y-4">
          <p>
            The token launch process in Facemelt represents a significant innovation in the AMM space.
            When a new memecoin token is created:
          </p>
          <div className="p-4 bg-secondary/40 rounded-lg font-mono">
            <p>y_total = Total token supply</p>
            <p>y_pool = y_total (100% of tokens in pool)</p>
            <p>x_virtual = Initial virtual base asset reserve</p>
          </div>
          <p>The initial constant product is established as:</p>
          <div className="p-4 bg-secondary/40 rounded-lg text-center font-mono">
            k_initial = x_virtual · y_pool
          </div>
          <p>
            This approach enables token creation without requiring real base asset liquidity, 
            as the token supply is fixed and 100% contained within the liquidity pool at launch.
          </p>
        </div>
      ),
    },
    {
      id: 'leverage-trading',
      title: 'Leverage Trading Mechanism',
      content: (
        <div className="space-y-4">
          <p>
            Facemelt introduces a novel approach to leverage trading that modifies the constant product invariant temporarily 
            while positions are open.
          </p>
          <p>When a trader opens a leveraged position with leverage factor L:</p>
          <div className="p-4 bg-secondary/40 rounded-lg font-mono">
            <p>Collateral = c</p>
            <p>Effective trade size = c · L</p>
            <p>Borrowed amount = c · (L - 1)</p>
          </div>
          <p>
            The leverage trade is executed as if it were a spot trade with size c · L, but the output tokens 
            are stored in a position manager rather than sent to the user's wallet.
          </p>
          <p>
            This operation modifies the constant product value temporarily and will be restored when the 
            position is closed or liquidated.
          </p>
        </div>
      ),
    },
    {
      id: 'liquidation',
      title: 'Liquidation Mechanism',
      content: (
        <div className="space-y-4">
          <p>
            The liquidation mechanism in Facemelt is designed to protect the protocol when leveraged positions become underwater.
          </p>
          <p>A position becomes eligible for liquidation when:</p>
          <div className="p-4 bg-secondary/40 rounded-lg text-center font-mono">
            Swapped output &lt; Borrowed amount
          </div>
          <p>
            This indicates that the position can no longer be closed profitably as the output would be less than the borrowed amount.
          </p>
          <p>
            Liquidations can be performed by any market participant when the AMM price crosses the liquidation price, 
            creating arbitrage opportunities.
          </p>
        </div>
      ),
    },
    {
      id: 'limbo-state',
      title: 'Limbo State',
      content: (
        <div className="space-y-4">
          <p>
            A unique feature of Facemelt is the "limbo state" for positions that experience extreme price movements.
          </p>
          <p>A position enters limbo when:</p>
          <div className="p-4 bg-secondary/40 rounded-lg font-mono">
            <p>Swapped output &lt; Borrowed amount</p>
            <p>and no liquidator has fulfilled the liquidation</p>
          </div>
          <p>
            This mathematical condition allows for positions to recover from temporary price shocks rather than 
            being forced into immediate liquidation, providing protection against flash crashes and manipulation.
          </p>
        </div>
      ),
    },
    {
      id: 'system-properties',
      title: 'System Properties',
      content: (
        <div className="space-y-4">
          <p>Facemelt's design provides several important guarantees:</p>
          <h3 className="text-lg font-bold mt-4">Solvency Guarantee</h3>
          <p>
            The solvency of the protocol is guaranteed by the zero-sum nature of the token supply and the constant product invariant.
          </p>
          <h3 className="text-lg font-bold mt-4">No Seed Capital Requirement</h3>
          <p>
            The virtual reserves model eliminates the need for seed capital by ensuring all token supply is in the pool at launch.
          </p>
          <h3 className="text-lg font-bold mt-4">Zero Bad Debt Guarantee</h3>
          <p>
            The protocol guarantees zero bad debt through its liquidation and limbo mechanisms. Under no circumstances 
            can a position create a debt that the protocol cannot recover, as the fixed token supply ensures all positions 
            are backed by real tokens.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-72px)]">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-card p-4 md:min-h-[calc(100vh-72px)] border-r border-border rounded-2xl md:rounded-l-2xl">
        <h2 className="text-xl font-bold mb-4 font-mono">Documentation</h2>
        <nav className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              className={`w-full p-2 text-left rounded-xl transition font-mono ${
                activeSection === section.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary/60'
              }`}
              onClick={() => setActiveSection(section.id)}
            >
              {section.title}
            </button>
          ))}
          <Link 
            href="/facemelt_whitepaper.tex" 
            target="_blank"
            className="block w-full p-2 text-left rounded-xl transition font-mono text-primary hover:bg-secondary/60 mt-4"
          >
            Download Whitepaper
          </Link>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-grow p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          {sections.map((section) => (
            <div
              key={section.id}
              className={activeSection === section.id ? 'block' : 'hidden'}
            >
              <h1 className="text-3xl font-bold mb-8 font-mono">{section.title}</h1>
              <div className="prose prose-invert max-w-none font-mono">
                {section.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 