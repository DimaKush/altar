"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { EtherInput } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const RefillForm = () => {
  const [amount, setAmount] = useState<string>("");

  const { writeContractAsync: refillWrite, isPending } = useScaffoldWriteContract({
    contractName: "Altar",
    // functionName: "refill",
    // args: [parseEther(amount || "0")],
  });

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
        className={`btn btn-primary ${isPending ? "loading" : ""}`}
        onClick={async () => {
          try {
            await refillWrite({
              functionName: "refill",
              args: [parseEther(amount || "0")],
            });
          } catch (e) {
            console.error("Error refill:", e);
          }
        }}
        disabled={!amount || isPending}
      >
        Refill
      </button>
    </div>
  );
}; 