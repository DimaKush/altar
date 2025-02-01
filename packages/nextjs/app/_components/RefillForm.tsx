"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { EtherInput } from "~~/components/scaffold-eth";
import { useScaffoldContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const RefillForm = () => {
  const [amount, setAmount] = useState<string>("");
  const [isApproving, setIsApproving] = useState(false);

  const { data: torchToken } = useScaffoldContract({
    contractName: "TORCH",
  });

  const { data: altarContract } = useScaffoldContract({
    contractName: "Altar",
  });

  const { writeContractAsync: approve } = useScaffoldWriteContract({
    contractName: "TORCH",
  });

  const { writeContractAsync: refillWrite, isPending } = useScaffoldWriteContract({
    contractName: "Altar",
  });

  const handleRefill = async () => {
    if (!amount || !torchToken || !altarContract) return;
    
    try {
      setIsApproving(true);
      // First approve
      await approve({
        functionName: "approve",
        args: [altarContract.address, parseEther(amount || "0")],
      });
      
      // Then refill
      await refillWrite({
        functionName: "refill",
        args: [parseEther(amount || "0")],
      });
    } catch (e) {
      console.error("Error refill:", e);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-base-100 rounded-xl">
      <div className="flex flex-col gap-2">
        <label className="text-sm">Amount of TORCH to Refill</label>
        <EtherInput
          value={amount}
          onChange={setAmount}
        />
      </div>
      <button 
        className={`btn btn-primary ${isApproving || isPending ? "loading" : ""}`}
        onClick={handleRefill}
        disabled={!amount || isApproving || isPending}
      >
        {isApproving ? "Approving..." : isPending ? "Refilling..." : "Refill"}
      </button>
    </div>
  );
}; 