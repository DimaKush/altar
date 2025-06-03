"use client";

import { useState } from "react";
import { CallerBalance } from "~~/hooks/scaffold-eth/useAltarEvents";
import { Address } from "~~/components/scaffold-eth";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";
import { useDisplayUsdMode } from "~~/hooks/scaffold-eth/useDisplayUsdMode";
import { useGlobalState } from "~~/services/store/store";

interface AltarTableProps {
  balances: CallerBalance[];
  connectedAddress?: string;
  isLoading?: boolean;
}

const formatNumber = (num: number | string) => {
  return Number(num).toFixed(5);
};

const CHAIN_CONFIGS = {
  "11155111": { name: "Sepolia", isL1: true },
  "11155420": { name: "Optimism Sepolia", isL2: true },
  "84532": { name: "Base Sepolia", isL2: true },  
  "534351": { name: "Scroll Sepolia", isL2: true },
} as const;

export const AltarTable = ({ balances, connectedAddress, isLoading }: AltarTableProps) => {
  const [sortBy, setSortBy] = useState<'price' | 'reserves' | 'holders'>('price');
  const { displayUsdMode, toggleDisplayUsdMode } = useDisplayUsdMode({});
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);
  const { bridge: { deployedL2Addresses } } = useGlobalState();

  const formatUsdValue = (ethValue: number | string) => {
    return formatNumber(Number(ethValue) * nativeCurrencyPrice);
  };

  const PriceDisplay = ({ ethValue }: { ethValue: number | string }) => (
    <span className="font-mono cursor-pointer" onClick={toggleDisplayUsdMode}>
      {displayUsdMode 
        ? `$${formatUsdValue(ethValue)}`
        : `${formatNumber(ethValue)} ETH`}
    </span>
  );

  const DeploymentStatus = ({ blesAddress }: { blesAddress: string }) => {
    return (
      <div className="flex flex-col gap-1">
        {Object.entries(CHAIN_CONFIGS).map(([chainId, config]) => {
          const isDeployed = ('isL1' in config && config.isL1) || deployedL2Addresses[chainId];
          
          return (
            <div key={chainId} className="flex items-center gap-2">
              <span className="text-sm">{config.name}</span>
              {isDeployed ? (
                <span className="badge badge-success badge-xs">✓</span>
              ) : (
                <span className="badge badge-ghost badge-xs">-</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Filter out the connected address from the table
  const filteredBalances = balances
    .filter(b => b.address !== connectedAddress)
    .sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return (Number(b.price) || 0) - (Number(a.price) || 0);
        case 'reserves':
          return (Number(b.reserve0) || 0) - (Number(a.reserve0) || 0);
        case 'holders':
          return (Number(b.holders.length) || 0) - (Number(a.holders.length) || 0);
        default:
          return 0;
      }
    });

  if (filteredBalances.length === 0) {
    return <p className="text-center">No other caller data available.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 justify-end">
        <button 
          className={`btn btn-sm w-32 ${sortBy === 'price' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setSortBy('price')}
        >
          Sort by Price
        </button>
        <button 
          className={`btn btn-sm w-32 ${sortBy === 'reserves' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setSortBy('reserves')}
        >
          Sort by Reserves
        </button>
        <button 
          className={`btn btn-sm w-32 ${sortBy === 'holders' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setSortBy('holders')}
        >
          Sort by Holders
        </button>
      </div>
      <div className="overflow-x-auto bg-base-100 rounded-lg shadow-sm">
        <table className="table w-full">
          <thead>
            <tr className="border-b border-base-200">
              <th className="text-left">Caller</th>
              <th className="text-left">Price</th>
              <th className="text-left">Reserves</th>
              <th className="text-left">Holders</th>
              <th className="text-left">Deployed Chains</th>
              <th className="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBalances.map((balance, index) => (
              <tr key={index} className="border-b border-base-200 last:border-none hover:bg-base-50">
                <td className="py-4">
                  <Address size="lg" address={balance.address}/>
                </td>
                <td className="py-4">
                  <PriceDisplay ethValue={balance.price} />
                </td>
                <td className="py-4">
                  <div className="flex flex-col text-sm">
                    <span className="font-mono">{formatNumber(balance.reserve0)} BLES</span>
                    <span className="font-mono text-base-content/70">{formatNumber(balance.reserve1)} ETH</span>
                  </div>
                </td>
                <td className="py-4">
                  <span className="font-mono">{balance.holders.length}</span>
                </td>
                <td className="py-4">
                  <DeploymentStatus blesAddress={balance.blesAddress} />
                </td>
                <td className="py-4">
                  <button 
                    onClick={() => window.open(`https://app.uniswap.org/swap?outputCurrency=${balance.blesAddress}`, '_blank')}
                    className="btn btn-sm btn-primary"
                  >
                    <ShoppingCartIcon className="h-4 w-4" />
                    Buy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};