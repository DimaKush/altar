import { useState, useEffect } from "react";
import { createPublicClient, http, parseAbi, formatEther } from 'viem';
import { sepolia } from 'viem/chains';
import { usePublicClient } from "wagmi";
import { useAllContracts } from "~~/utils/scaffold-eth/contractsData";
import erc20Abi from "~~/artifacts/IERC20.sol/IERC20.json";
import UniswapV2Pair from "~~/artifacts/UniswapV2Pair.json";
import UniswapV2Factory from "~~/artifacts/IUniswapV2Factory.json";

const TORCH_ADDRESS = '0x2C7B1F21e79D812d78c7a2E024aC3042C3e06f43';
const WETH_ADDRESS = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9';
const UNISWAP_FACTORY = '0x7E0987E5b3a30e3f2828572Bb659A548460a3003';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

export interface CallerBalance {
  address: `0x${string}`;
  blesAddress: `0x${string}`;
  ethBalance: string;
  blesBalance: string;
  torchBalance: string;
  reserve0: number;
  reserve1: number;
  price: number;
  priceImpact: number;
  pairStreamId: number;
  holders: { address: `0x${string}`; balance: string }[];
  totalTransfers: number;
}

interface DashboardData {
  balances: CallerBalance[];
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
}

export const useDashboardData = (address?: string): DashboardData => {
  const [balances, setBalances] = useState<CallerBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const publicClient = usePublicClient({chainId: 11155111});
  const contractsData = useAllContracts(11155111);
  const uniswapV2FactoryContract = contractsData.UniswapV2Factory;
  const wethContract = contractsData.WETH;
  const torchContract = contractsData.TORCH;

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all blesed data
      const blesedResponse = await fetch(`${API_URL}/blesed`);
      if (!blesedResponse.ok) throw new Error('Failed to fetch blesed data');
      const blesedData = await blesedResponse.json();

      // Fetch pairs data
      const pairsResponse = await fetch(`${API_URL}/pairs`);
      if (!pairsResponse.ok) throw new Error('Failed to fetch pairs data');
      const pairsData = await pairsResponse.json();

      if (!publicClient || !uniswapV2FactoryContract?.address || !wethContract?.address || !torchContract?.address) {
        throw new Error("Missing required contracts");
      }

      // Combine data and fetch on-chain balances
      const combinedData = await Promise.all(blesedData.map(async (b: any) => {
        const blesed = b.address as `0x${string}`;
        const blesToken = b.bles_token as `0x${string}`;

        try {
          const [ethBalance, blesBalance, torchBalance] = await Promise.all([
            publicClient.getBalance({ address: blesed }),
            publicClient.readContract({
              address: blesToken,
              abi: erc20Abi.abi,
              functionName: 'balanceOf',
              args: [blesed],
            }) as Promise<bigint>,
            publicClient.readContract({
              address: torchContract.address,
              abi: erc20Abi.abi,
              functionName: 'balanceOf',
              args: [blesed],
            }) as Promise<bigint>,
          ]);

          let price = 0;
          let priceImpact = 0;
          let reserve0 = 0;
          let reserve1 = 0;

          try {
            const pairAddress = await publicClient.readContract({
              address: uniswapV2FactoryContract.address,
              abi: UniswapV2Factory.abi,
              functionName: 'getPair',
              args: [blesToken, wethContract.address],
            }) as `0x${string}`;

            if (pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000') {
              const [reserves, token0] = await Promise.all([
                publicClient.readContract({
                  address: pairAddress,
                  abi: UniswapV2Pair,
                  functionName: 'getReserves',
                }) as Promise<[bigint, bigint, bigint]>,
                publicClient.readContract({
                  address: pairAddress,
                  abi: UniswapV2Pair,
                  functionName: 'token0',
                }) as Promise<`0x${string}`>,
              ]);

              const [blesReserve, ethReserve] = token0.toLowerCase() === blesToken.toLowerCase()
                ? [reserves[0], reserves[1]]
                : [reserves[1], reserves[0]];

              reserve0 = Number(formatEther(blesReserve));
              reserve1 = Number(formatEther(ethReserve));
              price = Number(ethReserve) / Number(blesReserve);
              priceImpact = blesBalance > 0n 
                ? ((Number(blesBalance) * (Number(ethReserve) / Number(blesReserve))) / Number(ethReserve)) * 100
                : 0;
            }
          } catch (error) {
            console.log("No liquidity pair found for token:", blesToken);
          }

          return {
            address: blesed,
            blesAddress: blesToken,
            ethBalance: formatEther(ethBalance),
            blesBalance: formatEther(blesBalance),
            torchBalance: formatEther(torchBalance),
            reserve0,
            reserve1,
            price,
            priceImpact,
            pairStreamId: b.stream_id,
            holders: b.holders || [],
            totalTransfers: b.total_transfers || 0,
          } as CallerBalance;
        } catch (error) {
          console.error("Error processing balance:", error);
          return null;
        }
      }));

      const validBalances = combinedData.filter((balance): balance is CallerBalance => 
        balance !== null && typeof balance.address === 'string' && balance.address.startsWith('0x')
      );

      setBalances(validBalances);
      setLastUpdated(new Date());

      // Save to localStorage
      localStorage.setItem('altarBalances', JSON.stringify({
        data: validBalances,
        timestamp: new Date().toISOString()
      }));

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    // Try to load from localStorage first
    const cached = localStorage.getItem('altarBalances');
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      setBalances(data);
      setLastUpdated(new Date(timestamp));
    }

    // Then fetch fresh data
    fetchData();
  }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    balances,
    isLoading,
    error,
    lastUpdated,
    refetch: fetchData
  };
}; 