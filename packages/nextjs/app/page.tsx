"use client";

import { useEffect, useState } from "react";
import { AltarTable } from "./_components/AltarTable";
import { SparkForm } from "./_components/SparkForm";
import { Address } from "~~/components/scaffold-eth";
import { useAltarEvents } from "~~/hooks/scaffold-eth/useAltarEvents";
import { useDeployedContractInfo, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { AllowedChainIds } from "~~/utils/scaffold-eth";
import { useAccount } from 'wagmi';
import { Dashboard } from "./_components/Dashboard";
import { NextPage } from "next";

const Home: NextPage = () => {
  const { address } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { data: altarContract } = useDeployedContractInfo({
    contractName: "Altar"
  });
  const { balances, isLoading } = useAltarEvents();
  
  // Add this hook to check if user has called Spark
  const hasCalledSpark = balances.some(b => b.address === address);

  const introText = `
Altar Protocol

Overview
A protocol for creating personalized ERC20 tokens with automated liquidity provision and locking.

Features
• Multi-chain liquidity management
• Automated rebalancing (coming soon)
• Cross-chain bridging (coming soon)
• Multiple DEX support (coming soon)

Getting Started
1. Connect your wallet
2. Spark your stream
3. Manage your liquidity
  `;
  
  return (
    <div className="container mx-auto mt-10 px-4">
      <div className="text-center mb-8">
        <div className="flex justify-center gap-8">
            <h1 className="text-4xl font-bold">Altar</h1>
          <Address address={altarContract?.address} />
        </div>
      </div>

      <div className="flex justify-center gap-8">
        <div className="card bg-base-100 shadow-xl w-max">
          <div className="card-body">
            {!address ? (
              <div className="whitespace-pre-line">
                {introText}
              </div>
            ) : hasCalledSpark ? (
              <Dashboard 
                address={address} 
                accountData={balances.find(b => b.address === address)}
                targetNetwork={targetNetwork}
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