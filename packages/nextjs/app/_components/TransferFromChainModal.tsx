"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { parseEther } from "viem";
import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import { getTargetNetworks } from "~~/utils/scaffold-eth";

interface TransferFromChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTokenAddress: string;
  deployedTokens: Record<string, string>; // chainId -> tokenAddress
  sourceChainId: number;
}

// ABIs for the bridge contracts
const L1StandardBridgeABI = [
  {
    inputs: [
      { name: "_localToken", type: "address" },
      { name: "_remoteToken", type: "address" },
      { name: "_to", type: "address" },
      { name: "_amount", type: "uint256" },
      { name: "_minGasLimit", type: "uint32" },
      { name: "_extraData", type: "bytes" }
    ],
    name: "bridgeERC20To",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];

const SuperchainTokenBridgeABI = [
  {
    inputs: [
      { name: "_token", type: "address" },
      { name: "_to", type: "address" },
      { name: "_amount", type: "uint256" },
      { name: "_chainId", type: "uint256" }
    ],
    name: "sendERC20",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];

const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  }
];

export const TransferFromChainModal = ({
  isOpen,
  onClose,
  sourceTokenAddress,
  deployedTokens,
  sourceChainId,
}: TransferFromChainModalProps) => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitchingNetwork } = useSwitchChain();
  
  const [amount, setAmount] = useState("");
  const [targetChainId, setTargetChainId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const targetNetworks = getTargetNetworks();
  const availableNetworks = targetNetworks.filter(network => 
    deployedTokens[network.id.toString()] && network.id !== sourceChainId
  );

  // При открытии модального окна выбираем первую доступную сеть по умолчанию
  useEffect(() => {
    if (isOpen && availableNetworks.length > 0 && !targetChainId) {
      setTargetChainId(availableNetworks[0].id.toString());
    }
    setNetworkError(null);
  }, [isOpen, availableNetworks, targetChainId]);

  // Check if we're on the correct network every time chainId changes
  useEffect(() => {
    if (isOpen) {
      setNetworkError(null);
    }
  }, [chainId, isOpen]);

  const isCorrectNetwork = chainId === sourceChainId;

  // Function to ensure user is on the correct network
  const ensureCorrectNetwork = async () => {
    if (!isCorrectNetwork && switchChain) {
      setNetworkError(null);
      try {
        switchChain({ chainId: sourceChainId });
        return false;
      } catch (error) {
        console.error("Failed to switch network:", error);
        setNetworkError(`Please switch to ${targetNetworks.find(n => n.id === sourceChainId)?.name} network to continue.`);
        return false;
      }
    }
    return true;
  };

  const handleTransfer = async () => {
    if (!address || !targetChainId || !amount || !walletClient) return;
    
    // Check if user is on the correct network
    if (!isCorrectNetwork) {
      await ensureCorrectNetwork();
      return;
    }
    
    try {
      setIsLoading(true);
      setNetworkError(null);
      
      const targetChainIdNumber = parseInt(targetChainId);
      // Convert amount to wei/atomic units (assumes the token uses 18 decimals)
      const amountInWei = parseEther(amount);
      
      if (!publicClient) {
        throw new Error("Public client not available");
      }
      
      // Determine if source chain is L1 (mainnet/sepolia)
      const isSourceL1 = sourceChainId === 1 || sourceChainId === 11155111; // 1 = Ethereum Mainnet, 11155111 = Sepolia
      
      if (isSourceL1) {
        // For L1 to L2 transfers, we need to get the L1StandardBridge address
        const l1StandardBridgeAddress = getL1StandardBridgeAddress(targetChainIdNumber);
        if (!l1StandardBridgeAddress) {
          throw new Error(`L1StandardBridge address not found for chain ${targetChainIdNumber}`);
        }
        
        // Add approval step
        console.log(`Approving L1StandardBridge to spend tokens...`);
        const approveTx = await walletClient.writeContract({
          address: sourceTokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [l1StandardBridgeAddress as `0x${string}`, amountInWei],
        });
        
        console.log(`Approval transaction submitted: ${approveTx}`);
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
        console.log('Approval confirmed');
        
        console.log(`L1 to L2 transfer: Using L1StandardBridge at ${l1StandardBridgeAddress}`);
        
        // Call bridgeERC20To at L1StandardBridge
        const tx = await walletClient.writeContract({
          address: l1StandardBridgeAddress as `0x${string}`,
          abi: L1StandardBridgeABI,
          functionName: 'bridgeERC20To',
          args: [
            sourceTokenAddress as `0x${string}`, 
            deployedTokens[targetChainId] as `0x${string}`, 
            address, 
            amountInWei, 
            50000n, // minGasLimit
            "0x" as `0x${string}` // extraData
          ],
        });
        
        console.log(`Transaction submitted: ${tx}`);
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log('Transaction confirmed');
      } else {
        // L2 to L2 transfer
        const superchainTokenBridge = "0x4200000000000000000000000000000000000028";
        console.log(`L2 to L2 transfer: Using SuperchainTokenBridge at ${superchainTokenBridge}`);
        
        // Call sendERC20 at SuperchainTokenBridge
        const tx = await walletClient.writeContract({
          address: superchainTokenBridge as `0x${string}`,
          abi: SuperchainTokenBridgeABI,
          functionName: 'sendERC20',
          args: [
            sourceTokenAddress as `0x${string}`, 
            address, 
            amountInWei, 
            BigInt(targetChainIdNumber),
          ],
        });
        
        console.log(`Transaction submitted: ${tx}`);
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log('Transaction confirmed');
      }

      onClose();
    } catch (error) {
      console.error("Transfer failed:", error);
      setNetworkError(`Transfer failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get L1StandardBridge address for a given chain
  const getL1StandardBridgeAddress = (chainId: number): string | undefined => {
    // This function should be implemented according to your application's configuration
    // For example, you might want to fetch this from an API, config file, or hardcode common addresses
    
    // Example implementation (replace with actual addresses):
    const bridgeAddresses: Record<number, string> = {
      11155420: "0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1", // OP Sepolia
      84532: "0xfd0Bf71F60660E2f608ed56e1659C450eB113120", // Base Sepolia
      // Add more chains as needed
    };
    
    return bridgeAddresses[chainId];
  };

  if (!isOpen) return null;

  const sourceNetwork = targetNetworks.find(n => n.id === sourceChainId);
  const sourceNetworkName = sourceNetwork?.name || `Chain ID ${sourceChainId}`;

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div className="fixed inset-0 bg-black opacity-30" onClick={onClose}></div>
        
        <div className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-base-100 p-6 text-left align-middle shadow-xl transition-all">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium leading-6 flex items-center gap-2">
              <ArrowsRightLeftIcon className="h-5 w-5" />
              Transfer Tokens Between Chains
            </h3>
            <button 
              className="btn btn-sm btn-ghost" 
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          
          <div className="mt-4">
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">From Chain</span>
              </label>
              <div className={`input input-bordered flex items-center ${isCorrectNetwork ? '' : 'input-warning'}`}>
                {sourceNetworkName}
                {!isCorrectNetwork && (
                  <div className="ml-2 badge badge-warning badge-sm">Not connected</div>
                )}
              </div>
            </div>

            <div className="form-control w-full mt-2">
              <label className="label">
                <span className="label-text">To Chain</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={targetChainId}
                onChange={(e) => setTargetChainId(e.target.value)}
                disabled={!isCorrectNetwork}
              >
                <option disabled value="">Select Target Chain</option>
                {availableNetworks.map((network) => (
                  <option key={network.id} value={network.id.toString()}>
                    {network.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-control w-full mt-2">
              <label className="label">
                <span className="label-text">Amount</span>
              </label>
              <input
                type="text"
                placeholder="0.0"
                className="input input-bordered w-full"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!isCorrectNetwork}
              />
            </div>

            {!isCorrectNetwork && (
              <div className="alert alert-warning mt-4 py-2 text-sm">
                <div>You need to connect to {sourceNetworkName} to make this transfer</div>
              </div>
            )}

            {networkError && (
              <div className="alert alert-error mt-4 py-2 text-sm">
                <div>{networkError}</div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
            >
              Cancel
            </button>
            {!isCorrectNetwork ? (
              <button
                type="button"
                className={`btn btn-primary ${isSwitchingNetwork ? "loading" : ""}`}
                onClick={ensureCorrectNetwork}
                disabled={isSwitchingNetwork}
              >
                {isSwitchingNetwork ? "Switching..." : `Switch to ${sourceNetworkName}`}
              </button>
            ) : (
              <button
                type="button"
                className={`btn btn-primary ${isLoading ? "loading" : ""}`}
                onClick={handleTransfer}
                disabled={!targetChainId || !amount || isLoading}
              >
                {isLoading ? "Processing..." : "Transfer"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 