"use client";

import { CallerBalance } from "~~/hooks/scaffold-eth/useAltarEvents";
import { Address } from "~~/components/scaffold-eth";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

interface AltarTableProps {
  balances: CallerBalance[];
  connectedAddress?: string;
}

export const AltarTable = ({ balances, connectedAddress }: AltarTableProps) => {
  // Filter out the connected address from the table
  const filteredBalances = balances.filter(b => b.address !== connectedAddress);

  if (filteredBalances.length === 0) {
    return <p className="text-center">No other caller data available.</p>;
  }

  return (
    <div className="overflow-x-auto bg-base-100 rounded-lg shadow-sm">
      <table className="table w-full">
        <tbody>
          {filteredBalances.map((balance, index) => (
            <tr key={index} className="border-b border-base-200 last:border-none">
              <td className="w-1/3 py-6">
                <div className="flex flex-col gap-3">
                  <Address address={balance.address} />
                  
                  <table className="table-auto w-full text-xs">
                    <thead>
                      <tr className="text-base-content/50">
                        <th className="text-left font-medium">Chain</th>
                        <th className="text-left font-medium">Amount</th>
                        <th className="text-left font-medium">Address</th>
                        <th className="text-left font-medium">UniswapV2</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1">Ethereum</td>
                        <td className="py-1 font-mono">{balance.blesBalance} BLES</td>
                        <td className="py-1"><Address address={balance.blesAddress} /></td>
                        <td className="py-1">
                          <div className="flex flex-col">
                            <span className="font-mono">Price: {balance.price} ETH/BLES</span>
                            <span className="font-mono">Reserves: {balance.reserve0} BLES</span>
                            <span className="font-mono">{balance.reserve1} ETH</span>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1">Optimism</td>
                        <td className="py-1 font-mono">0.00 BLES</td>
                        <td className="py-1"><Address address="0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" /></td>
                        <td className="py-1">-</td>
                      </tr>
                      <tr>
                        <td className="py-1">Base</td>
                        <td className="py-1 font-mono">0.00 BLES</td>
                        <td className="py-1"><Address address="0x4200000000000000000000000000000000000006" /></td>
                        <td className="py-1">-</td>
                      </tr>
                      <tr>
                        <td className="py-1">Scroll</td>
                        <td className="py-1 font-mono">0.00 BLES</td>
                        <td className="py-1"><Address address="0x5300000000000000000000000000000000000004" /></td>
                        <td className="py-1">-</td>
                      </tr>
                      <tr>
                        <td className="py-1">Move</td>
                        <td className="py-1 font-mono">0.00 BLES</td>
                        <td className="py-1"><Address address="0x6c00000000000000000000000000000000000005" /></td>
                        <td className="py-1">-</td>
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
                    <span className="font-mono text-sm">{balance.ethBalance} ETH</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-base-content/70">TORCH Balance</span>
                      <div className="tooltip tooltip-right" data-tip="TORCH token balance in wallet">
                        <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
                      </div>
                    </div>
                    <span className="font-mono text-sm">{balance.torchBalance} TORCH</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-base-content/70">Rug Price Impact</span>
                      <div className="tooltip tooltip-right" data-tip="Price impact if all tokens were sold at once">
                        <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
                      </div>
                    </div>
                    <span className="font-mono text-sm">{balance.priceImpact.toFixed(2)}%</span>
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}; 