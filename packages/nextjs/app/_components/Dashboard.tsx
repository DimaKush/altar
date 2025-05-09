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
import { useState, useEffect } from "react";
import { BridgeModal } from "./BridgeModal";
import { NETWORK_CONFIGS } from "./BridgeModal";
import { parseAbiItem, decodeEventLog, parseEther } from "viem";
import { createPublicClient, http } from "viem";
import { erc20Abi } from "viem";
import { optimismSepolia, baseSepolia } from "viem/chains";
import { usePublicClient } from "wagmi";
import scaffoldConfig from "~~/scaffold.config";

interface DashboardProps {
  address: string;
  accountData?: CallerBalance;
}

const formatNumber = (num: number | string) => {
  return Number(num).toFixed(9);
};

const calculateMarketCap = (price: number | string, totalSupply: number | string) => {
  return Number(price) * Number(totalSupply);
};

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

const formatL2Balance = (balance: bigint | undefined) => {
  if (!balance) return "0.000000000";
  return formatNumber(Number(balance) / 1e18);
};

const L2_RPC = {
  optimism: `https://opt-sepolia.g.alchemy.com/v2/${scaffoldConfig.alchemyApiKey}`,
  base: `https://base-sepolia.g.alchemy.com/v2/${scaffoldConfig.alchemyApiKey}`
};

export const Dashboard = ({ address, accountData }: DashboardProps) => {
  const { displayUsdMode, toggleDisplayUsdMode } = useDisplayUsdMode({});
  const blesAddress = accountData?.blesAddress;
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isBridgeModalOpen, setBridgeModalOpen] = useState(false);
  const [bridgeModalNetwork, setBridgeModalNetwork] = useState<keyof typeof NETWORK_CONFIGS | null>(null);
  const [l2Tokens, setL2Tokens] = useState<Record<string, `0x${string}`>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [l2Balances, setL2Balances] = useState<Record<string, bigint>>({});
  const publicClient = usePublicClient(); 
  const { bridge: { deployedL2Addresses }, setBridgeL2Address } = useGlobalState();

  const formatUsdValue = (ethValue: number | string) => {
    return (Number(ethValue) * nativeCurrencyPrice).toFixed(2);
  };

  const PriceDisplay = ({ ethValue }: { ethValue: number | string }) => (
    <span className="font-mono cursor-pointer" onClick={toggleDisplayUsdMode}>
      {displayUsdMode 
        ? `$${formatUsdValue(ethValue)}`
        : `${formatNumber(ethValue)} ETH`}
    </span>
  );

  const renderBridgeButton = (network: keyof typeof NETWORK_CONFIGS) => (
    <div className="flex items-center gap-2">
      <button
        className="p-1 hover:bg-base-200 rounded-full transition-colors"
        onClick={() => setBridgeModalNetwork(network)}
      >
        <ArrowsRightLeftIcon className="h-4 w-4" />
      </button>
      {NETWORK_CONFIGS[network].name}
    </div>
  );

  useEffect(() => {
    const checkBridgedTokens = async () => {
      setIsLoading(true);
      try {
        if (!accountData) {
          console.error("No account data available");
          return;
        }
        console.log("Checking L2 tokens for:", accountData.blesAddress);
        
        for (const [network, config] of Object.entries(NETWORK_CONFIGS)) {
          const l2Client = createPublicClient({
            chain: network === 'optimism' ? optimismSepolia : baseSepolia,
            transport: http(L2_RPC[network as keyof typeof L2_RPC])
          });

          const logs = await l2Client.getLogs({
            address: config.factory,
            event: parseAbiItem('event OptimismMintableERC20Created(address indexed localToken, address indexed remoteToken, address deployer)'),
            args: {
              remoteToken: accountData.blesAddress as `0x${string}`
            },
            fromBlock: 0n,
            toBlock: 'latest'
          });

          console.log(`Found ${logs.length} logs for ${network}`);
          console.log("Logs:", logs);

          if (logs.length > 0) {
            const lastLog = logs[logs.length - 1];
            setBridgeL2Address(network, lastLog.args.localToken as `0x${string}`);
          }
        }
      } catch (error) {
        console.error("Error checking L2 tokens:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (address && accountData?.blesAddress) {
      checkBridgedTokens();
    }
  }, [address, accountData?.blesAddress, setBridgeL2Address]);

  useEffect(() => {
    const getL2Balances = async () => {
      try {
        const l2Clients = {
          optimism: createPublicClient({
            chain: optimismSepolia,
            transport: http(L2_RPC.optimism)
          }),
          base: createPublicClient({
            chain: baseSepolia,
            transport: http(L2_RPC.base)
          }),
        };

        for (const [network, tokenAddress] of Object.entries(deployedL2Addresses)) {
          if (tokenAddress && address) {
            const balance = await l2Clients[network as keyof typeof l2Clients].readContract({
              address: tokenAddress,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [address]
            });

            setL2Balances(prev => ({
              ...prev,
              [network]: balance
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching L2 balances:", error);
      }
    };

    if (Object.keys(deployedL2Addresses).length > 0 && address) {
      getL2Balances();
    }
  }, [deployedL2Addresses, address]);

  if (isLoading) {
    return <div>Checking bridge history...</div>;
  }

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
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-base-200">
            <td className="py-3">Sepolia</td>
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
              {renderBridgeButton("optimism")}
            </td>
            <td className="py-3 font-mono flex items-center gap-1">
              <div>{formatL2Balance(l2Balances.optimism)}</div>
              <a
                href={`${NETWORK_CONFIGS.optimism.explorerUrl}/address/${deployedL2Addresses.optimism || ''}`}
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
              {renderBridgeButton("base")}
            </td>
            <td className="py-3 font-mono flex items-center gap-1">
              <div>{formatNumber(Number(l2Balances.base || 0n))}</div>
              <a          
                href={`${NETWORK_CONFIGS.base.explorerUrl}/address/${deployedL2Addresses.base || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-primary"
              >
                BLES
              </a>
            </td>
            <td className="py-3">-</td>
          </tr>
          <tr className="border-b border-base-200">
            <td className="py-3">
              {renderBridgeButton("scroll")}
            </td>
            <td className="py-3 font-mono flex items-center gap-1">
              <div>{formatNumber(Number(l2Balances.scroll || 0n))}</div>
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
          onClick={() => window.open(`https://app.sablier.com/vesting/stream/LL3-${11155111}-${accountData.pairStreamId}/`, '_blank')}
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
        }}
        blesAddress={accountData.blesAddress}
      />

      {bridgeModalNetwork && (
        <BridgeModal 
          isOpen={!!bridgeModalNetwork}
          onClose={() => setBridgeModalNetwork(null)}
          blesAddress={accountData.blesAddress}
          network={bridgeModalNetwork}
          l2TokenAddress={deployedL2Addresses[bridgeModalNetwork]}
        />
      )}
    </div>
  );
}; 