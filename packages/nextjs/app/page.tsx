"use client";

import { AltarTable } from "./_components/AltarTable";
import { SparkForm } from "./_components/SparkForm";
import { Address } from "~~/components/scaffold-eth";
import { useDashboardData } from "~~/hooks/scaffold-eth/useDashboardData";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useAccount } from 'wagmi';
import { Dashboard } from "./_components/Dashboard";
import { NextPage } from "next";

const Home: NextPage = () => {
  const { address } = useAccount();
  const { data: altarContract } = useDeployedContractInfo({
    contractName: "Altar",
    chainId: 11155111
  });
  const { balances, isLoading } = useDashboardData();
  
  // console.log("altarContract",altarContract);
  // console.log("balances", balances);
  // console.log("address", address);

  const hasCalledSpark = balances.some(b => b.address === address);

  const introText = `
Altar Protocol

Create your personal ERC20 token backed by locked ETH liquidity.

What is Altar?
A protocol that lets you mint your own BLES token by locking ETH for 27.4 years in Uniswap V2 pools.

What is BLES?
Your personal ERC20 token with 10^18 supply. Trade it, gift it, or use it as reputation token.

What is SuperBLES?
Cross-chain version of your BLES token. Deploy to Optimism, Base or other Superchain with native OP Stack bridging.

How it works:
• Lock ETH → Get BLES tokens + TORCH rewards
• Choose division (0-10) to control token split
• Automatic liquidity provision via Uniswap V2
• LP tokens locked for 10,000 days via Sablier

Getting Started:
1. Connect wallet
2. Choose division and ETH amount
3. Spark your stream
4. Deploy cross-chain via SuperBLES
5. Bridge to other chains
6. Provide liquidity to DEXs
7. Donate BLES instead of ETH and fiat


TODO:
- Same address deployment at L1 and L2
- DEX integrations
- Rebalancing feature
`;
  
  return (
    <div className="container mx-auto mt-10 px-2 sm:px-4">
      <div className="text-center mb-4 sm:mb-8">
        <div className="flex justify-center gap-4 sm:gap-8">
            <h1 className="text-3xl sm:text-4xl font-bold">Altar</h1>
          <Address address={altarContract?.address} />
        </div>
      </div>

      <div className="flex justify-center gap-8">
        <div className="card bg-base-100 shadow-xl w-full md:w-max max-w-full">
          <div className="card-body p-4 md:p-8">
            {!address ? (
              <div className="whitespace-pre-line">
                {introText}
              </div>
            ) : hasCalledSpark ? (
              <Dashboard 
                address={address} 
              />
            ) : (
              <SparkForm />
            )}
          </div>
        </div>
      </div>
      
      {address && (
        <>
          <div className="card bg-base-100 shadow-xl mt-4">
            <div className="card-body">
            <AltarTable 
            balances={balances} 
            connectedAddress={address}
            isLoading={isLoading} 
          />
            </div>
          </div>
        </>
      )} 
    </div>
  );
};

export default Home; 