"use client";

import { Address } from "~~/components/scaffold-eth";
import { BridgeButton } from "./bridgeButton";
import { DisperseButton } from "./DisperseButton";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { CallerBalance } from "~~/hooks/scaffold-eth/useAltarEvents";
import { SendButton } from "./SendButton";

interface DashboardProps {
  address: string;
  accountData?: CallerBalance;
}

export const Dashboard = ({ address, accountData }: DashboardProps) => {
  if (!accountData) return <div>No account data available</div>;

  return (
    <div className="flex flex-col gap-4">
      <Address address={address} />

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
            <td className="py-1 font-mono">{accountData.blesBalance} BLES</td>
            <td className="py-1"><Address address={accountData.blesAddress} /></td>
            <td className="py-1">
              <div className="flex flex-col">
                <span className="font-mono">Price: {accountData.price} ETH/BLES</span>
                <span className="font-mono">Reserves: {accountData.reserve0} BLES</span>
                <span className="font-mono">{accountData.reserve1} ETH</span>
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

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-sm text-base-content/70">ETH Balance</span>
            <div className="tooltip tooltip-right" data-tip="Native ETH balance in wallet">
              <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
            </div>
          </div>
          <span className="font-mono text-sm">{accountData.ethBalance} ETH</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-sm text-base-content/70">TORCH Balance</span>
            <div className="tooltip tooltip-right" data-tip="TORCH token balance in wallet">
              <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
            </div>
          </div>
          <span className="font-mono text-sm">{accountData.torchBalance} TORCH</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-sm text-base-content/70">Rug Price Impact</span>
            <div className="tooltip tooltip-right" data-tip="Price impact if all tokens were sold at once">
              <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
            </div>
          </div>
          <span className="font-mono text-sm">{accountData.priceImpact.toFixed(2)}%</span>
        </div>
      </div>

      <div className="flex gap-4">
        <BridgeButton />
        <DisperseButton />
        <SendButton />
      </div>
    </div>
  );
}; 