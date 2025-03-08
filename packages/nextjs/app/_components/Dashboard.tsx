"use client";

import { Address } from "~~/components/scaffold-eth";
import { BridgeButton } from "./bridgeButton";
import { DisperseButton } from "./DisperseButton";
import { InformationCircleIcon, ArrowsRightLeftIcon, PaperAirplaneIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";
import { CallerBalance } from "~~/hooks/scaffold-eth/useAltarEvents";
import { SendButton } from "./SendButton";
import { ManageLockedLiquidityButton } from "./ManageLockedLiquidityButton";
import { RefillButton } from "./RefillButton";
import { ChainWithAttributes } from "~~/utils/scaffold-eth";
import { useDisplayUsdMode } from "~~/hooks/scaffold-eth/useDisplayUsdMode";
import { useGlobalState } from "~~/services/store/store";
import { SendModal } from "./SendModal";
import { useState } from "react";

interface DashboardProps {
  address: string;
  accountData?: CallerBalance;
  targetNetwork: ChainWithAttributes;
}

// Helper function for consistent number formatting
const formatNumber = (num: number | string) => {
  return Number(num).toFixed(9);
};

// Add the same calculation helper
const calculateMarketCap = (price: number | string, totalSupply: number | string) => {
  return Number(price) * Number(totalSupply);
};

// First, add a styled wrapper for the amount display
const AmountDisplay = ({ amount, onSend }: { amount: string | number, onSend: () => void }) => {
  return (
    <div className="group relative inline-flex items-center gap-2">
      <div>{formatNumber(amount)}</div>
      <button 
        onClick={onSend}
        className="opacity-0 group-hover:opacity-100 absolute -left-6 transition-opacity duration-200 p-1 hover:bg-base-200 rounded-full"
      >
        <PaperAirplaneIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

export const Dashboard = ({ address, accountData, targetNetwork }: DashboardProps) => {
  const { displayUsdMode, toggleDisplayUsdMode } = useDisplayUsdMode({});
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  // Add helper for USD conversion
  const formatUsdValue = (ethValue: number | string) => {
    return formatNumber(Number(ethValue) * nativeCurrencyPrice);
  };

  // Add PriceDisplay component
  const PriceDisplay = ({ ethValue }: { ethValue: number | string }) => (
    <span className="font-mono cursor-pointer" onClick={toggleDisplayUsdMode}>
      {displayUsdMode 
        ? `$${formatUsdValue(ethValue)}`
        : `${formatNumber(ethValue)} ETH`}
    </span>
  );

  if (!accountData) return <div>No account data available</div>;

  return (
    <div className="flex flex-col gap-4">
      <Address address={address} />

      <table className="table-auto w-full text-xs">
        <thead>
          <tr className="text-base-content/50">
            <th className="text-left font-medium w-1/6">Chain</th>
            <th className="text-left font-medium w-1/6">Amount</th>
            <th className="text-left font-medium w-1/3">
              <a
                href="https://app.uniswap.org/#/swap?use=V2"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline cursor-pointer"
              >
                UniswapV2
              </a>
            </th>
            <th className="text-left font-medium w-1/6">
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
                  onClick={() => window.open(`https://app.uniswap.org/#/swap?outputCurrency=${accountData.blesAddress}`, '_blank')}
                  className="btn btn-xs btn-primary w-16"
                >
                  BUY
                </button> */}
              </div>
            </th>
            <th className="text-left font-medium w-1/6">
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
          <tr className="border-b border-base-200">
            <td className="py-3">
              <div className="flex items-center gap-2">
                <button
                  className="p-1 hover:bg-base-200 rounded-full transition-colors"
                  onClick={() => console.log('Bridge to Ethereum')}
                >
                  <ArrowsRightLeftIcon className="h-4 w-4" />
                </button>
                Sepolia
              </div>
            </td>
            <td className="py-3 font-mono flex items-center gap-1">
              <AmountDisplay 
                amount={accountData.blesBalance} 
                onSend={() => setIsSendModalOpen(true)}
              />
              <a
                href={`https://sepolia.etherscan.io/address/${accountData.blesAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-primary"
              >
                BLES
              </a>
            </td>
            <td className="py-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-mono">Price: <PriceDisplay ethValue={accountData.price} /></span>
                  <button 
                    onClick={() => window.open(`https://app.uniswap.org/#/swap?outputCurrency=${accountData.blesAddress}`, '_blank')}
                    className="p-1 hover:bg-base-200 rounded-full transition-colors"
                  >
                    <ShoppingCartIcon className="h-4 w-4 text-primary" />
                  </button>
                </div>
                <span className="font-mono">Reserves: {formatNumber(accountData.reserve0)} BLES</span>
                <span className="font-mono">{formatNumber(accountData.reserve1)} ETH</span>
              </div>
            </td>
            <td className="py-3">-</td>
            <td className="py-3">-</td>
          </tr>
          <tr className="border-b border-base-200">
            <td className="py-3">
              <div className="flex items-center gap-2">
                <button
                  className="p-1 hover:bg-base-200 rounded-full transition-colors"
                  onClick={() => console.log('Bridge to Optimism')}
                >
                  <ArrowsRightLeftIcon className="h-4 w-4" />
                </button>
                Optimism
              </div>
            </td>
            <td className="py-3 font-mono flex items-center gap-1">
              <div>{formatNumber(0)}</div>
              <a
                href="https://optimistic.etherscan.io/address/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-primary"
              >
                BLES
              </a>
            </td>
            <td className="py-3">-</td>
            <td className="py-3">-</td>
            <td className="py-3">-</td>
          </tr>
          <tr className="border-b border-base-200">
            <td className="py-3">
              <div className="flex items-center gap-2">
                <button
                  className="p-1 hover:bg-base-200 rounded-full transition-colors"
                  onClick={() => console.log('Bridge to Base')}
                >
                  <ArrowsRightLeftIcon className="h-4 w-4" />
                </button>
                Base
              </div>
            </td>
            <td className="py-3 font-mono flex items-center gap-1">
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
            <td className="py-3">-</td>
            <td className="py-3">-</td>
            <td className="py-3">-</td>
          </tr>
          <tr className="border-b border-base-200">
            <td className="py-3">
              <div className="flex items-center gap-2">
                <button
                  className="p-1 hover:bg-base-200 rounded-full transition-colors"
                  onClick={() => console.log('Bridge to Scroll')}
                >
                  <ArrowsRightLeftIcon className="h-4 w-4" />
                </button>
                Scroll
              </div>
            </td>
            <td className="py-3 font-mono flex items-center gap-1">
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
            <td className="py-3">-</td>
            <td className="py-3">-</td>
            <td className="py-3">-</td>
          </tr>
          <tr className="border-b border-base-200">
            <td className="py-3">
              <div className="flex items-center gap-2">
                <button
                  className="p-1 hover:bg-base-200 rounded-full transition-colors"
                  onClick={() => console.log('Bridge to Move')}
                >
                  <ArrowsRightLeftIcon className="h-4 w-4" />
                </button>
                Move
              </div>
            </td>
            <td className="py-3 font-mono flex gap-1">
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
            <td className="py-3">-</td>
            <td className="py-3">-</td>
            <td className="py-3">-</td>
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-4 gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-sm text-base-content/70">ETH Balance</span>
            <div className="tooltip tooltip-right" data-tip="Native ETH balance in wallet">
              <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
            </div>
          </div>
          <span className="font-mono text-sm">{formatNumber(accountData.ethBalance)} ETH</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-sm text-base-content/70">TORCH Balance</span>
            <div className="tooltip tooltip-right" data-tip="TORCH token balance in wallet">
              <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
            </div>
          </div>
          <span className="font-mono text-sm">{formatNumber(accountData.torchBalance)} TORCH</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-sm text-base-content/70">Exit Price Impact</span>
            <div className="tooltip tooltip-right" data-tip="Price impact if all tokens were sold at once">
              <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
            </div>
          </div>
          <span className="font-mono text-sm">{formatNumber(accountData.priceImpact)}%</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-sm text-base-content/70">Market Cap</span>
            <div className="tooltip tooltip-right" data-tip="Total Market Value (Price * Total Supply)">
              <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
            </div>
          </div>
          <span className="font-mono text-sm"><PriceDisplay ethValue={calculateMarketCap(accountData.price, 1)} /></span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm">holders: {accountData.holders.length}</span>
        {accountData.holders.map((holder, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            <Address address={holder.address} />
            <span className="font-mono">{formatNumber(holder.balance)} BLES</span>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          className="btn btn-sm w-32 btn-outline"
          onClick={() => console.log('Bridge')}
        >
          Bridge
        </button>
        <button
          className="btn btn-sm w-32 btn-outline"
          onClick={()=>window.open("https://disperse.app/", '_blank')}
        >
          Disperse
        </button>
        <button
          className="btn btn-sm w-32 btn-outline"
          onClick={() => setIsSendModalOpen(true)}
        >
          Send
        </button>
        <button
          className="btn btn-sm w-32 btn-outline"
          onClick={() => window.open(`https://app.sablier.com/vesting/stream/LL3-${targetNetwork.id}-${accountData.pairStreamId}/`, '_blank')}
        >
          Manage Liquidity
        </button>
        <RefillButton />
      </div>

      <SendModal 
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        onSend={(toAddress, amount) => {
          console.log('Sending', amount, 'BLES to', toAddress);
          // Add your send logic here
        }}
        blesAddress={accountData.blesAddress}
      />
    </div>
  );
}; 