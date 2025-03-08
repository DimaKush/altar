"use client";

import { useState } from "react";
import { Address } from "~~/components/scaffold-eth";
import { useWriteContract } from "wagmi";
import { parseEther } from "viem";
import erc20Abi from "~~/artifacts/IERC20.sol/IERC20.json";

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (toAddress: string, amount: string) => void;
  blesAddress: `0x${string}`;
}

export const SendModal = ({ isOpen, onClose, onSend, blesAddress }: SendModalProps) => {
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");

  const { writeContractAsync, isPending: isMining } = useWriteContract();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await writeContractAsync({
        abi: erc20Abi.abi,
        address: blesAddress,
        functionName: "transfer",
        args: [toAddress, parseEther(amount)],
      });
      onSend(toAddress, amount);
      onClose();
      // Reset form
      setToAddress("");
      setAmount("");
    } catch (error) {
      console.error("Error sending tokens:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-base-200 p-6 rounded-lg w-96">
        <h3 className="text-lg font-bold mb-4">Send BLES</h3>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">To Address</span>
            </label>
            <input
              type="text"
              placeholder="0x..."
              className="input input-bordered w-full"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Amount</span>
            </label>
            <input
              type="number"
              step="0.000000001"
              min="0"
              placeholder="0.0"
              className="input input-bordered w-full"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <button
              type="button"
              className="btn btn-sm"
              onClick={onClose}
              disabled={isMining}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={isMining}
            >
              {isMining ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
