"use client";

import { useEffect, useState } from "react";
import { AltarTable } from "./_components/AltarTable";
import { RefillForm } from "./_components/RefillForm";
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
  const { data: altarContract } = useDeployedContractInfo({
    contractName: "Altar"
  });
  const { balances, isLoading } = useAltarEvents();
  
  // Add this hook to check if user has called Spark
  const hasCalledSpark = balances.some(b => b.address === address);

  // const [rpcUrl, setRpcUrl] = useState("");
  // const [isEditing, setIsEditing] = useState(false);

  // // Load RPC URL from localStorage on mount
  // useEffect(() => {
  //   const savedRpcUrl = localStorage.getItem("custom-rpc-url");
  //   if (savedRpcUrl) setRpcUrl(savedRpcUrl);
  // }, []);

  // const handleRpcUpdate = () => {
  //   if (rpcUrl) {
  //     localStorage.setItem("custom-rpc-url", rpcUrl);
  //     // Optionally force page reload to apply new RPC
  //     window.location.reload();
  //   }
  //   setIsEditing(false);
  // };

  return (
    <div className="container mx-auto mt-10 px-4">
      <div className="text-center mb-8">
        <div>
          <a href="https://github.com/DimaKush/altar">
            <h1 className="text-4xl font-bold mb-6">Altar</h1>
          </a>
          <Address address={altarContract?.address} />
        </div>
        
        {/* RPC URL Input
        <div className="mt-4 flex items-center justify-center gap-2">
          {isEditing ? (
            <>
              <input
                type="text"
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
                placeholder="Enter RPC URL"
                className="input input-bordered input-sm w-96"
              />
              <button 
                onClick={handleRpcUpdate}
                className="btn btn-sm btn-primary"
              >
                Save
              </button>
              <button 
                onClick={() => setIsEditing(false)}
                className="btn btn-sm btn-ghost"
              >
                Cancel
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-50">
                RPC: {rpcUrl ? `${rpcUrl.slice(0, 20)}...` : "Default"}
              </span>
              <button 
                onClick={() => setIsEditing(true)}
                className="btn btn-sm btn-ghost"
              >
                Edit
              </button>
            </div>
          )}
        </div> */}
      </div>

      <div className="flex w-full gap-8 mb-8">
        <div className="card bg-base-100 shadow-xl w-max">
          <div className="card-body">
            <h2 className="card-title">
              {hasCalledSpark ? "TODO: Dashboard" : "TODO: Spark"}
            </h2>
            {hasCalledSpark ? (
              <Dashboard 
                address={address || ''} 
                accountData={balances.find(b => b.address === address)}
              />
            ) : (
              <SparkForm />
            )}
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl w-max">
          <div className="card-body">
            <h2 className="card-title">Refill</h2>
            <RefillForm />
          </div>
        </div>
      </div>
      <div>TODO: Holders</div>
      <div>TODO: Fetch Dune Analytics</div>
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <AltarTable 
            balances={balances} 
            // isLoading={isLoading} 
          />
        </div>
      </div>
    </div>
  );
};

export default Home; 