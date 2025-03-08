"use client";

import { useState } from "react";
import { CallerBalance } from "~~/hooks/scaffold-eth/useAltarEvents";
import { Address } from "~~/components/scaffold-eth";
import { InformationCircleIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";
import { AddressCopyIcon } from "~~/components/scaffold-eth/Address/AddressCopyIcon";
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

const calculateMarketCap = (price: number | string, totalSupply: number | string) => {
  return Number(price) * Number(totalSupply);
};

export const AltarTable = ({ balances, connectedAddress, isLoading }: AltarTableProps) => {
  const [sortBy, setSortBy] = useState<'price' | 'reserves' | 'holders'>('price');
  const { displayUsdMode, toggleDisplayUsdMode } = useDisplayUsdMode({});
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);

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
          <tbody>
            {filteredBalances.map((balance, index) => (
              balance.address !== connectedAddress && (
                <tr key={index} className="border-b border-base-200 last:border-none">
                  <td className="w-1/3 py-6">
                    <div className="flex flex-col gap-3">
                    <Address size="xl" address={balance.address}/>
                    <table className="table-auto w-full text-xs">
                      <thead>
                        <tr className="text-base-content/50">
                          <th className="text-left font-medium">Chain</th>
                          <th className="text-left font-medium">Amount</th>
                          <th className="text-left font-medium">
                            <a 
                              href="https://app.uniswap.org/#/swap?use=V2" 
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline cursor-pointer"
                            >
                              UniswapV2
                            </a>
                          </th>
                          <th className="text-left font-medium">
                            <div className="flex flex-col gap-2">
                              <a 
                                href="https://app.uniswap.org/#/swap" 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline cursor-pointer"
                              >
                                UniswapV3
                              </a>
                              {/* <button 
                                onClick={() => window.open(`https://app.uniswap.org/#/swap?outputCurrency=${balance.blesAddress}`, '_blank')}
                                className="btn btn-xs btn-primary w-16"
                              >
                                BUY
                              </button> */}
                            </div>
                          </th>
                          <th className="text-left font-medium">
                            <a 
                              href="https://app.balancer.fi/" 
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline cursor-pointer"
                            >
                              Balancer
                            </a>
                          </th>
                          <th className="text-left font-medium">
                            <a 
                              href="https://ajna.finance/" 
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline cursor-pointer"
                            >
                              Ajna
                            </a>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-1">
                            <div className="flex items-center gap-2">
                              Sepolia
                            </div>
                          </td>
                          <td className="py-1 font-mono flex gap-1 items-center">
                            <div>{formatNumber(balance.blesBalance)}</div>
                            <a 
                              href={`https://sepolia.etherscan.io/token/${balance.blesAddress}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline text-primary"
                            >
                              BLES
                            </a>
                          </td>
                          <td className="py-1">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-mono">Price: <PriceDisplay ethValue={balance.price} /></span>
                                <button 
                                  onClick={() => window.open(`https://app.uniswap.org/#/swap?outputCurrency=${balance.blesAddress}`, '_blank')}
                                  className="p-1 hover:bg-base-200 rounded-full transition-colors"
                                >
                                  <ShoppingCartIcon className="h-4 w-4 text-primary" />
                                </button>
                              </div>
                              <span className="font-mono">Reserves: {formatNumber(balance.reserve0)} BLES</span>
                              <span className="font-mono">{formatNumber(balance.reserve1)} ETH</span>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1">
                            <div className="flex items-center gap-2">
                              Optimism
                            </div>
                          </td>
                          <td className="py-1 font-mono flex gap-1">
                            <div>{formatNumber(0)}</div>
                            <a 
                              href="https://optimistic.etherscan.io/token/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline text-primary"
                            >
                              BLES
                            </a>
                          </td>
                          <td className="py-1">-</td>
                        </tr>
                        <tr>
                          <td className="py-1">
                            <div className="flex items-center gap-2">
                              Base
                            </div>
                          </td>
                          <td className="py-1 font-mono flex gap-1">
                          <div>{formatNumber(0)}</div>
                            <a 
                              href="https://base.blockscout.com/address/0x4200000000000000000000000000000000000006" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline text-primary"
                            >
                              BLES
                            </a>
                          </td>
                          <td className="py-1">-</td>
                        </tr>
                        <tr>
                          <td className="py-1">
                            <div className="flex items-center gap-2">
                              Scroll
                            </div>
                          </td>
                          <td className="py-1 font-mono flex gap-1">
                            <div>{formatNumber(0)}</div>
                            <a 
                              href="https://scrollscan.com/address/0x5300000000000000000000000000000000000004" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline text-primary"
                            >
                              BLES
                            </a>
                          </td>
                          <td className="py-1">-</td>
                        </tr>
                        <tr>
                          <td className="py-1">
                            <div className="flex items-center gap-2">
                              Move
                            </div>
                          </td>
                          <td className="py-1 font-mono flex gap-1">
                            <div>{formatNumber(0)}</div>
                            <a 
                              href="https://move.blockscout.com/address/0x6c00000000000000000000000000000000000005" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline text-primary"
                            >
                              BLES
                            </a>
                          </td>
                          <td className="py-1">-</td>
                        </tr>
                        <tr>
                          <td className="py-1">Holders Info</td>
                          <td className="py-1" colSpan={4}>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">Total Transfers: {balance.totalTransfers}</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-sm">holders: {balance.holders.length}</span>
                                {balance.holders.map((holder, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-sm">
                                    <Address size="xs"address={holder.address} />
                                    <span className="font-mono">{formatNumber(holder.balance)} BLES</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
                <td className="py-6">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-base-content/70">ETH Balance</span>
                        <div className="tooltip tooltip-right" data-tip="Native ETH balance in wallet">
                          <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
                        </div>
                      </div>
                      <span className="font-mono text-sm">{formatNumber(balance.ethBalance)} ETH</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-base-content/70">TORCH Balance</span>
                        <div className="tooltip tooltip-right" data-tip="TORCH token balance in wallet">
                          <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
                        </div>
                      </div>
                      <span className="font-mono text-sm">{Number(balance.torchBalance).toFixed(9)} TORCH</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-base-content/70">Exit Price Impact</span>
                        <div className="tooltip tooltip-right" data-tip="Price impact if all tokens were sold at once">
                          <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
                        </div>
                      </div>
                      <span className="font-mono text-sm">{Number(balance.priceImpact).toFixed(2)}%</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-base-content/70">Market Cap</span>
                        <div className="tooltip tooltip-right" data-tip="Total Market Value (Price * Total Supply)">
                          <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
                        </div>
                      </div>
                      <span className="font-mono text-sm">
                        <PriceDisplay ethValue={calculateMarketCap(balance.price, 1)} />
                      </span>
                    </div>
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}; 