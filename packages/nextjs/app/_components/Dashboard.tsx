"use client";

import { Address } from "~~/components/scaffold-eth";
import { BridgeButton } from "./bridgeButton";
import { DisperseButton } from "./DisperseButton";
import { InformationCircleIcon, ArrowsRightLeftIcon, PaperAirplaneIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";
import { CallerBalance } from "~~/hooks/scaffold-eth/useDashboardData";
import { SendButton } from "./SendButton";
import { ManageLockedLiquidityButton } from "./ManageLockedLiquidityButton";
import { RefillButton } from "./RefillButton";
import { ChainWithAttributes } from "~~/utils/scaffold-eth";
import { useDisplayUsdMode } from "~~/hooks/scaffold-eth/useDisplayUsdMode";
import { useGlobalState } from "~~/services/store/store";
import { SendModal } from "./SendModal";
import { useState, useEffect } from "react";
// import { BridgeModal } from "./BridgeModal";
// import { NETWORK_CONFIGS } from "./BridgeModal";
import { usePublicClient, useAccount } from "wagmi";
import scaffoldConfig from "~~/scaffold.config";
import { BridgeDeployModal } from "./BridgeDeployModal";
import { useDashboardData } from "~~/hooks/scaffold-eth/useDashboardData";
import { getTargetNetworks } from "~~/utils/scaffold-eth/networks";
import { TransferFromChainModal } from "./TransferFromChainModal";
import { formatEther } from "viem";
import { createPublicClient, http, Chain, PublicClient } from "viem";

interface DashboardProps {
  address: string;
}

const formatNumber = (num: number | string) => {
  return Number(num).toFixed(5);
};

const formatTorchBalance = (num: number | string) => {
  return Number(num).toFixed(18);
};

const formatPriceImpact = (num: number | string) => {
  return Number(num).toFixed(1);
};

const formatMarketCap = (num: number | string) => {
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


const getDeployedSuperbles = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem('superbles_deployed_addresses') || '{}');
  } catch {
    return {};
  }
};

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
];

export const Dashboard = ({ address }: DashboardProps) => {
  const { displayUsdMode, toggleDisplayUsdMode } = useDisplayUsdMode({});
  const { balances, isLoading, error } = useDashboardData();
  const accountData = balances.find(b => b.address === address);
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const { bridge: { deployedL2Addresses }, setBridgeL2Address } = useGlobalState();
  const [isBridgeDeployModalOpen, setBridgeDeployModalOpen] = useState(false);
  const [deployedSuperbles, setDeployedSuperbles] = useState<Record<string, string>>({});
  const targetNetworks = getTargetNetworks();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedSourceChain, setSelectedSourceChain] = useState<number>(11155111); // Sepolia chainId
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const [l2Balances, setL2Balances] = useState<Record<string, string>>({});

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

  const fetchDeployedSuperbles = async () => {
    if (!accountData?.blesAddress) return;
    
    console.log('Fetching deployed Superbles for', accountData.blesAddress);
    
    try {
      // Try to load from localStorage first
      const cachedDeployments = getDeployedSuperbles();
      if (Object.keys(cachedDeployments).length > 0) {
        console.log('Using cached deployments from localStorage:', cachedDeployments);
        setDeployedSuperbles(cachedDeployments);
      }
      
      // Then try to fetch from API
      const response = await fetch(`/api/superbles/${accountData.blesAddress}`);
      if (response.ok) {
        const deployments = await response.json();
        console.log('Received deployments:', deployments);
        
        if (!Array.isArray(deployments)) {
          console.error('Expected array of deployments, got:', deployments);
          return;
        }
        
        const mappedDeployments = deployments.reduce((acc: Record<string, string>, dep: { chain_id: number, l2_token: string }) => {
          acc[dep.chain_id.toString()] = dep.l2_token;
          return acc;
        }, {});
        
        console.log('Mapped deployments:', mappedDeployments);
        
        // Only update if we got new data
        if (Object.keys(mappedDeployments).length > 0) {
          setDeployedSuperbles(mappedDeployments);
          localStorage.setItem('superbles_deployed_addresses', JSON.stringify(mappedDeployments));
        }
      } else {
        console.warn('API returned non-OK status:', response.status);
      }
    } catch (error) {
      console.warn('Failed to fetch deployed superbles:', error);
      // No need to throw - we're already using cached data if available
    }
  };

  const fetchL2Balances = async () => {
    if (!userAddress) return;
    
    const newBalances: Record<string, string> = {};
    for (const [chainId, tokenAddress] of Object.entries(deployedSuperbles)) {
      try {
        const network = targetNetworks.find(n => n.id.toString() === chainId);
        if (!network?.rpcUrls?.default?.http?.[0]) {
          console.error(`No RPC URL found for chain ${chainId}`);
          continue;
        }

        const transport = http(network.rpcUrls.default.http[0]);
        const client = createPublicClient({
          chain: network as Chain,
          transport,
        });

        const balance = await client.readContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [userAddress],
        }) as bigint;
        
        newBalances[chainId] = formatEther(balance);
      } catch (error) {
        console.error(`Failed to fetch balance for chain ${chainId}:`, error);
        newBalances[chainId] = "0.000000000";
      }
    }
    setL2Balances(newBalances);
  };

  useEffect(() => {
    fetchDeployedSuperbles();
  }, [accountData?.blesAddress]);

  useEffect(() => {
    if (Object.keys(deployedSuperbles).length > 0) {
      fetchL2Balances();
    }
  }, [userAddress, deployedSuperbles]);

  if (isLoading) {
    return <div>Loading dashboard data...</div>;
  }

  if (error) {
    return <div>Error loading dashboard: {error.message}</div>;
  }

  if (!accountData) return <div>No account data available</div>;

  return (
    <div className="flex flex-col gap-4">
      <Address address={address} />

      <table className="table-auto w-full text-xs overflow-x-auto block md:table">
        <thead>
          <tr className="text-base-content/50">
            <th className="text-left font-medium w-1/6 min-w-[100px]">Chain</th>
            <th className="text-left font-medium w-1/3 min-w-[150px]">
              <a
                href="https://app.uniswap.org/#/swap?use=V2"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline cursor-pointer"
              >
                UniswapV2
              </a>
            </th>
            
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-base-200">
            <td className="py-3 flex items-center gap-2">
              {Object.keys(deployedSuperbles).length > 0 && (
                <button
                  className="btn btn-xs btn-ghost p-1"
                  onClick={() => {
                    setSelectedSourceChain(11155111); // Sepolia chainId
                    setIsTransferModalOpen(true);
                  }}
                >
                  <ArrowsRightLeftIcon className="h-3.5 w-3.5 text-primary" />
                </button>
              )}
              Sepolia
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
                    onClick={() => window.open(`https://app.uniswap.org/swap?outputCurrency=${accountData.blesAddress}`, '_blank')}
                    className="p-1 hover:bg-base-200 rounded-full transition-colors"
                  >
                    <ShoppingCartIcon className="h-4 w-4 text-primary" />
                  </button>
                </div>
                <span className="font-mono">Reserves: {formatNumber(accountData.reserve0)} BLES</span>
                <span className="font-mono">{formatNumber(accountData.reserve1)} ETH</span>
              </div>
            </td>          
          </tr>
          {targetNetworks
            .filter(n => n.name !== "Sepolia" && deployedSuperbles[n.id])
            .map(network => {
              const superblesAddress = deployedSuperbles[network.id];
              
              return (
                <tr key={network.id} className="border-b border-base-200">
                  <td className="py-3 flex items-center gap-2">
                    {superblesAddress && (
                      <button
                        className="btn btn-xs btn-ghost p-1"
                        onClick={() => {
                          setSelectedSourceChain(network.id);
                          setIsTransferModalOpen(true);
                        }}
                      >
                        <ArrowsRightLeftIcon className="h-3.5 w-3.5 text-primary" />
                      </button>
                    )}
                    {network.name}
                  </td>
                  <td className="py-3 font-mono flex items-center gap-1">
                    {superblesAddress ? (
                      <>
                        <AmountDisplay 
                          amount={l2Balances[network.id.toString()] || "0.000000000"}
                          onSend={() => setIsSendModalOpen(true)}
                        />
                        <a
                          href={`${network.blockExplorers?.default?.url}/address/${superblesAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-primary"
                        >
                          BLES
                        </a>
                        <div className="tooltip" data-tip="Copy Address">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(superblesAddress);
                            }}
                            className="p-1 hover:bg-base-200 rounded-full transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                            </svg>
                          </button>
                        </div>
                      </>
                    ) : (
                      <span className="text-base-content/50">Not deployed</span>
                    )}
                  </td>
                  <td className="py-3">
                    {superblesAddress ? (
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-mono">Price: <PriceDisplay ethValue="0.0" /></span>
                          <button 
                            onClick={() => window.open(`${network.blockExplorers?.default?.url}/address/${superblesAddress}`, '_blank')}
                            className="p-1 hover:bg-base-200 rounded-full transition-colors"
                          >
                            <ShoppingCartIcon className="h-4 w-4 text-primary" />
                          </button>
                        </div>
                        <span className="font-mono">Reserves: 0.000000000 BLES</span>
                        <span className="font-mono">0.000000000 ETH</span>
                      </div>
                    ) : (
                      <button
                        className="btn btn-xs btn-outline"
                        onClick={() => setBridgeDeployModalOpen(true)}
                      >
                        Deploy
                      </button>
                    )}
                  </td>                  
                </tr>
              );
            })}
        </tbody>
      </table>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <span className="font-mono text-sm">{formatTorchBalance(accountData.torchBalance)} TORCH</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-sm text-base-content/70">Exit Price Impact</span>
            <div className="tooltip tooltip-right" data-tip="Price impact if all tokens were sold at once">
              <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
            </div>
          </div>
          <span className="font-mono text-sm">{formatPriceImpact(accountData.priceImpact)}%</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-sm text-base-content/70">Market Cap</span>
            <div className="tooltip tooltip-right" data-tip="Total Market Value (Price * Total Supply)">
              <InformationCircleIcon className="h-4 w-4 text-base-content/50" />
            </div>
          </div>
          <span className="font-mono text-sm"><PriceDisplay ethValue={formatMarketCap(calculateMarketCap(accountData.price, 1))} /></span>
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

      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-sm w-full sm:w-32 btn-outline"
          onClick={() => setBridgeDeployModalOpen(true)}
        >
          Deploy Bridge
        </button>
        <button
          className="btn btn-sm w-full sm:w-32 btn-outline"
          onClick={()=>window.open("https://disperse.app/", '_blank')}
        >
          Disperse
        </button>
        <button
          className="btn btn-sm w-full sm:w-32 btn-outline"
          onClick={() => setIsSendModalOpen(true)}
        >
          Send
        </button>
        <button
          className="btn btn-sm w-full sm:w-32 btn-outline"
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

      {/* {bridgeModalNetwork && (
        <BridgeModal 
          isOpen={!!bridgeModalNetwork}
          onClose={() => setBridgeModalNetwork(null)}
          blesAddress={accountData.blesAddress}
          network={bridgeModalNetwork}
          l2TokenAddress={deployedL2Addresses[bridgeModalNetwork]}
        />
      )} */}

      <BridgeDeployModal 
        isOpen={isBridgeDeployModalOpen}
        onClose={() => setBridgeDeployModalOpen(false)}
        blesAddress={accountData.blesAddress}
      />

      <TransferFromChainModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        sourceTokenAddress={accountData?.blesAddress || ""}
        deployedTokens={deployedSuperbles}
        sourceChainId={selectedSourceChain}
      />

      {/* Отладочная информация */}
      <div className="mt-8 p-4 bg-base-200 rounded-lg text-xs overflow-x-auto">
        <h3 className="text-sm font-bold mb-2">Debug Info (Development Only)</h3>
        <div>L1 Token Address: {accountData.blesAddress}</div>
        <div>Deployed Superbles: {JSON.stringify(deployedSuperbles)}</div>
        <div className="mt-2">
          <div>
            <div className="font-bold mt-2">Deployments detected in indexer:</div>
            <ul className="list-disc list-inside mt-1">
              {Object.entries(deployedSuperbles).map(([chainId, tokenAddress]) => (
                <li key={chainId}>Chain {chainId}: {tokenAddress}</li>
              ))}
            </ul>
            {Object.keys(deployedSuperbles).length === 0 && (
              <div className="text-red-500">No deployments found! Check indexer and API.</div>
            )}
          </div>
          <button 
            className="btn btn-xs btn-outline"
            onClick={() => {
              localStorage.removeItem('superbles_deployed_addresses');
              setDeployedSuperbles({});
              console.log('Cleared cached deployments');
            }}
          >
            Clear Cache
          </button>
          <button 
            className="btn btn-xs btn-outline ml-2"
            onClick={() => {
              fetchDeployedSuperbles();
            }}
          >
            Refresh Deployments
          </button>
        </div>
      </div>
    </div>
  );
}; 