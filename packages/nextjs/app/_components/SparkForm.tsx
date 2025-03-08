"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther } from "viem";
import { AddressInput, EtherInput } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

const getDivisionPercentage = (div: number) => {
  const percentages = [100, 61.80, 38.20, 23.61, 14.58, 9.02, 5.57, 3.44, 2.13, 1.32, 0.81];
  return percentages[div];
};

export const SparkForm = () => {
  const { address } = useAccount();
  const [division, setDivision] = useState<number>(0);
  const [referral, setReferral] = useState<string>("");
  const [ethValue, setEthValue] = useState<string>("0.1");

  const { writeContractAsync: sparkWrite, isPending } = useScaffoldWriteContract({
    contractName: "Altar"
  });

  return (
    <div className="flex flex-col gap-4 p-4 bg-base-100 rounded-xl w-[400px]">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <div>
            <label className="text-sm">Division</label>
            <div className="tooltip tooltip-right" data-tip="Division determines BLES token split">
              <a href="https://github.com/dimakush/altar/blob/master/README.md#usage" target="_blank" rel="noopener noreferrer">
                <InformationCircleIcon className="h-4 w-4 text-sm ml-1" />
              </a>
            </div>
          </div>

          <span className="text-sm font-mono">
            {division} ({getDivisionPercentage(division)}%)
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          value={division}
          onChange={e => setDivision(Number(e.target.value))}
          className="range range-primary range-sm"
          step={1}
        />
        <div className="w-full flex justify-between text-xs px-2">
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
          <span>|</span>
        </div>
        <div className="w-full flex justify-between text-xs px-2">
          <span>0</span>
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
          <span>6</span>
          <span>7</span>
          <span>8</span>
          <span>9</span>
          <span>10</span>
        </div>
      </div>
      {division == 0 && <div className="text-xs text-base-content/50">
        <p className="text-xs text-base-content/100">
          Donation mode: 100% of the ETH value will be donated to the Altar.
        </p>
      </div>}
      {division > 0 &&
        <div className="flex flex-col gap-2">
          <div>
            <label className="text-sm">Referral Address (optional)</label>
            <div className="tooltip tooltip-right" data-tip="Referal">
              <InformationCircleIcon className="h-4 w-4 text-sm ml-1" />
            </div>
          </div>
          <AddressInput
            value={referral}
            onChange={setReferral}
            placeholder="0x..."
          />
        </div>}

      <div className="flex flex-col gap-2">
        <label className="text-sm">ETH Value</label>
        <EtherInput
          value={ethValue}
          onChange={setEthValue}
        />
      </div>

      <button
        className={`btn btn-primary ${isPending ? "loading" : ""}`}
        onClick={async () => {
          try {
            await sparkWrite({
              functionName: "spark",
              args: [BigInt(division), referral || "0x0000000000000000000000000000000000000000"],
              value: parseEther(ethValue),
            })
          } catch (e) {
            console.error("Error spark:", e);
          }
        }}
        disabled={!address || isPending}
      >
        Spark
      </button>
    </div>
  );
}; 