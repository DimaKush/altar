import { useState, useEffect } from "react";
import { formatEther} from "viem";
import { usePublicClient } from "wagmi";
import { useScaffoldEventHistory } from "./useScaffoldEventHistory";
import { AllowedChainIds, notification } from "~~/utils/scaffold-eth";
import UniswapV2Pair from "~~/artifacts/UniswapV2Pair.json";
import UniswapV2Factory from "~~/artifacts/IUniswapV2Factory.json";
import erc20Abi from "~~/artifacts/IERC20.sol/IERC20.json";
import { useTargetNetwork } from "./useTargetNetwork";
import { useAllContracts } from "~~/utils/scaffold-eth/contractsData";

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
}

export const useAltarEvents = () => {
  const [balances, setBalances] = useState<CallerBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const publicClient = usePublicClient();
  const { targetNetwork } = useTargetNetwork();
  const contractsData = useAllContracts();
  const uniswapV2FactoryContract = contractsData.UniswapV2Factory;
  const wethContract = contractsData.WETH;
  const torchContract = contractsData.TORCH;


  const fromBlock = targetNetwork.id === 11155111 ? BigInt(7589485) : BigInt(21599730);
  const { data: events, isLoading: isLoadingEvents } = useScaffoldEventHistory({
    contractName: "Altar",
    eventName: "Blesed",
    fromBlock: fromBlock,
    chainId: targetNetwork.id as AllowedChainIds,
    // watch: true,
  });

  console.log("Events from useScaffoldEventHistory:", {
    events,
    isLoadingEvents,
    fromBlock: fromBlock
  });

  useEffect(() => {
    if (!events?.length || !publicClient) {
      console.log("Skipping fetchBalances:", { 
        hasEvents: !!events?.length, 
        eventsLength: events?.length,
        hasPublicClient: !!publicClient 
      });
      return;
    }

    const fetchBalances = async () => {
      try {
        setIsLoading(true);
        const factoryAddress = uniswapV2FactoryContract?.address;
        const wethAddress = wethContract?.address;
        const torchAddress = torchContract?.address;

        console.log("Starting fetchBalances with:", {
          factoryAddress,
          wethAddress,
          torchAddress,
          events: events.map(e => ({
            blesed: e.args.blesed,
            blesToken: e.args.blesToken,
            eventName: e.eventName
          }))
        });

        if (!factoryAddress || !wethAddress || !torchAddress) {
          console.error("Missing addresses:", {
            hasFactory: !!factoryAddress,
            hasWeth: !!wethAddress,
            hasTorch: !!torchAddress
          });
          throw new Error("Missing required addresses in env");
        }

        const processedBalances = await Promise.all(
          events.map(async (event, index) => {
            console.log(`Processing event ${index}:`, {
              blesed: event.args.blesed,
              blesToken: event.args.blesToken
            });

            if (!event.args.blesed || !event.args.blesToken) {
              console.warn(`Event ${index} missing args:`, event.args);
              return null;
            }

            const blesed = event.args.blesed as `0x${string}`;
            const blesToken = event.args.blesToken as `0x${string}`;

            try {
              // Get basic balances first
              const [ethBalance, blesBalance, torchBalance] = await Promise.all([
                publicClient.getBalance({ address: blesed }),
                publicClient.readContract({
                  address: blesToken,
                  abi: erc20Abi.abi,
                  functionName: 'balanceOf',
                  args: [blesed],
                }) as Promise<bigint>,
                publicClient.readContract({
                  address: torchAddress,
                  abi: erc20Abi.abi,
                  functionName: 'balanceOf',
                  args: [blesed],
                }) as Promise<bigint>,
              ]);

              // Try to get pair info, but don't fail if it doesn't exist
              let price = 0;
              let priceImpact = 0;
              let reserve0 = 0;
              let reserve1 = 0;

              try {
                const pairAddress = await publicClient.readContract({
                  address: factoryAddress,
                  abi: UniswapV2Factory.abi,
                  functionName: 'getPair',
                  args: [blesToken, wethAddress],
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
              } as CallerBalance;
            } catch (error) {
              console.error("Error processing event:", { event, error });
              return null;
            }
          })
        );

        const validBalances = processedBalances.filter((balance): balance is CallerBalance => 
          balance !== null && typeof balance.address === 'string' && balance.address.startsWith('0x')
        );
        console.log("Valid balances:", validBalances);
        setBalances(validBalances);
      } catch (error) {
        console.error("Error processing events:", error);
        notification.error("Failed to process events");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalances();
  }, [events, publicClient]);

  return { balances, isLoading: isLoading || isLoadingEvents };
};