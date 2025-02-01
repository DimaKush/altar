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

const Home: NextPage  = () => {
  const { address } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { data: altarContract } = useDeployedContractInfo({
    contractName: "Altar"
  });
  const { balances, isLoading } = useAltarEvents();
  
  // Add this hook to check if user has called Spark
  const hasCalledSpark = balances.some(b => b.address === address);

  return (
    <div className="container mx-auto mt-10 px-4">
      <div className="text-center mb-8">
        <div>
          <a href="https://github.com/DimaKush/altar">
            <h1 className="text-4xl font-bold mb-6">Altar</h1>
          </a>
          <Address address={altarContract?.address} />
        </div>
      </div>

      <div className="flex w-max gap-8 mb-8">
        <div className="card bg-base-100 shadow-xl w-max">
          <div className="card-body">
            <h2 className="card-title">
              {hasCalledSpark ? "TODO: Dashboard" : "TODO: Spark"}
            </h2>
            {hasCalledSpark ? (
              <Dashboard 
                address={address || ''} 
                accountData={balances.find(b => b.address === address)}
                targetNetwork={targetNetwork}
              />
            ) : (
              <SparkForm />
            )}
          </div>
        </div>
      </div>
      <div>TODO: Holders</div>
      <div>TODO: Fetch Dune Analytics</div>
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <AltarTable 
            balances={balances} 
            isLoading={isLoading} 
          />
        </div>
      </div>
    </div>
  );
};

export default Home; 