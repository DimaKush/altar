"use client";

import { useState, useEffect } from "react";
import { Address } from "~~/components/scaffold-eth";
import { useWriteContract, useChainId, useSwitchChain, usePublicClient } from "wagmi";
import { parseEther } from "viem";
import erc20Abi from "~~/artifacts/IERC20.sol/IERC20.json";

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (toAddress: string, amount: string) => void;
  blesAddress: `0x${string}`;
  chainId: number;
}

export const SendModal = ({ isOpen, onClose, onSend, blesAddress, chainId }: SendModalProps) => {
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [isTokenDeployed, setIsTokenDeployed] = useState<boolean | null>(null);
  const [isCheckingDeployment, setIsCheckingDeployment] = useState(false);

  const { writeContractAsync, isPending: isMining } = useWriteContract();
  const currentChainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const publicClient = usePublicClient();

  // Check if token is deployed when modal opens or chain changes
  useEffect(() => {
    const checkTokenDeployment = async () => {
      if (!isOpen || !blesAddress || !publicClient || currentChainId !== chainId) {
        setIsTokenDeployed(null);
        return;
      }

      setIsCheckingDeployment(true);
      try {
        // Try to read the token name to verify it's deployed
        await publicClient.readContract({
          address: blesAddress,
          abi: erc20Abi.abi,
          functionName: 'name',
        });
        setIsTokenDeployed(true);
      } catch (error) {
        console.error('Token not deployed or invalid:', error);
        setIsTokenDeployed(false);
      } finally {
        setIsCheckingDeployment(false);
      }
    };

    checkTokenDeployment();
  }, [isOpen, blesAddress, currentChainId, chainId, publicClient]);

  if (!isOpen) return null;

  const isOnCorrectChain = currentChainId === chainId;
  const canSend = isOnCorrectChain && isTokenDeployed === true && !isCheckingDeployment;

  const handleSwitchChain = async () => {
    try {
      await switchChain({ chainId });
    } catch (error) {
      console.error("Error switching chain:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canSend) {
      return;
    }

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
        
        {!isOnCorrectChain && (
          <div className="alert alert-warning mb-4">
            <div className="flex flex-col">
              <span>Wrong network! Please switch to chain {chainId}</span>
              <button
                className="btn btn-sm btn-warning mt-2"
                onClick={handleSwitchChain}
                disabled={isSwitching}
              >
                {isSwitching ? "Switching..." : `Switch to Chain ${chainId}`}
              </button>
            </div>
          </div>
        )}

        {isOnCorrectChain && isCheckingDeployment && (
          <div className="alert alert-info mb-4">
            <span>Checking if Superbles is deployed on this chain...</span>
          </div>
        )}

        {isOnCorrectChain && !isCheckingDeployment && isTokenDeployed === false && (
          <div className="alert alert-error mb-4">
            <div className="flex flex-col">
              <span>Superbles token is not deployed on this chain!</span>
              <span className="text-sm mt-1">Deploy the token first before sending.</span>
            </div>
          </div>
        )}
        
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
              disabled={!canSend}
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
              disabled={!canSend}
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
              disabled={isMining || !canSend}
            >
              {isMining ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
