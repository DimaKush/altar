"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { erc20Abi } from "viem";
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useSwitchChain, useReadContract } from "wagmi";
import { notification } from "~~/utils/scaffold-eth";
import { parseAbiItem, decodeEventLog, toEventSelector } from 'viem';
import { waitForTransactionReceipt } from "viem/actions";
import { createPublicClient, http, parseEther, formatEther } from "viem";
import { sepolia, optimismSepolia, baseSepolia } from "viem/chains";
import { useGlobalState } from "~~/services/store/store";

interface NetworkConfig {
  name: string;
  gateway: `0x${string}`;
  factory: `0x${string}`;
  tokenPrefix: string;
  explorerUrl: string;
}

const FACTORY_ABI = [{"inputs":[{"internalType":"address","name":"_bridge","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"localToken","type":"address"},{"indexed":true,"internalType":"address","name":"remoteToken","type":"address"},{"indexed":false,"internalType":"address","name":"deployer","type":"address"}],"name":"OptimismMintableERC20Created","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"remoteToken","type":"address"},{"indexed":true,"internalType":"address","name":"localToken","type":"address"}],"name":"StandardL2TokenCreated","type":"event"},{"inputs":[],"name":"BRIDGE","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_remoteToken","type":"address"},{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"}],"name":"createOptimismMintableERC20","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_remoteToken","type":"address"},{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"}],"name":"createStandardL2Token","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"version","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"}]

const GATEWAY_ABI = [
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
] as const;

export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  optimism: {
    name: "Optimism Sepolia",
    gateway: "0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1",
    factory: "0x4200000000000000000000000000000000000012",
    tokenPrefix: "op",
    explorerUrl: "https://sepolia-optimism.etherscan.io",
  },
  base: {
    name: "Base Sepolia",
    gateway: "0x4200000000000000000000000000000000000010",
    factory: "0x4200000000000000000000000000000000000010",
    tokenPrefix: "base",
    explorerUrl: "https://sepolia.basescan.org",
  },
  scroll: {
    name: "Scroll Sepolia",
    gateway: "0x5300000000000000000000000000000000000004",
    factory: "0x5300000000000000000000000000000000000004",
    tokenPrefix: "scroll",
    explorerUrl: "https://sepolia-scroll.etherscan.io",
  }
};

interface BridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  blesAddress: `0x${string}`;
  network: keyof typeof NETWORK_CONFIGS;
  l2TokenAddress?: `0x${string}`;
}

const L2_CHAIN_IDS = {
  optimism: 11155420, 
  base: 84532,     
  scroll: 534351,  
} as const;

const L2_TOKEN_CREATED_EVENT = parseAbiItem(
  'event OptimismMintableERC20Created(address indexed localToken, address indexed remoteToken, address deployer)'
);

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http()
});

export const BridgeModal = ({ isOpen, onClose, blesAddress, network, l2TokenAddress }: BridgeModalProps) => {
  const { 
    bridge: { step, amount },
    setBridgeStep,
    setBridgeAmount,
    setBridgeL2Address,
    resetBridgeState
  } = useGlobalState();

  const { address, chain } = useAccount();
  const networkConfig = NETWORK_CONFIGS[network];
  const [deployHash, setDeployHash] = useState<`0x${string}`>();
  const { data: receipt } = useWaitForTransactionReceipt({ hash: deployHash });
  const { switchChain } = useSwitchChain();
  const [approvalHash, setApprovalHash] = useState<`0x${string}`>();
  const [isDeploying, setIsDeploying] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isBridging, setIsBridging] = useState(false);
  
  const { data: gatewayBalance } = useReadContract({
    address: blesAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [networkConfig.gateway],
    chainId: 11155111, 
  });

  const { data: allowance } = useReadContract({
    address: blesAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, networkConfig.gateway] : undefined,
    chainId: 11155111,
  });

  const { writeContractAsync: deployL2Token } = useWriteContract();
  const { writeContractAsync: approve } = useWriteContract();
  const { writeContractAsync: bridge } = useWriteContract();

  const modalRef = useRef<HTMLDivElement>(null);

  const handleOutsideClick = (e: MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (l2TokenAddress) {
        setBridgeStep('approve');
      } else {
        resetBridgeState();
      }
    }
  }, [isOpen, l2TokenAddress]);

  useEffect(() => {
    if (receipt) {
      const log = receipt.logs.find(
        log => log.topics[0] === toEventSelector(L2_TOKEN_CREATED_EVENT)
      );

      if (log) {
        const { args } = decodeEventLog({
          abi: [L2_TOKEN_CREATED_EVENT],
          data: log.data,
          topics: log.topics,
        });

        setBridgeStep('approve');
        notification.success("L2 Token deployed successfully!");
      }
    }
  }, [receipt]);

  const handleDeploy = async () => {
    if (l2TokenAddress) {
      console.log("L2 token already deployed at:", l2TokenAddress);
      setBridgeStep('approve');
      return;
    }

    if (chain?.id !== L2_CHAIN_IDS[network as keyof typeof L2_CHAIN_IDS]) {
      notification.info(`Please switch to ${networkConfig.name} to deploy the L2 token`);
      return;
    }

    setIsDeploying(true);
    console.log("Starting deploy process on", networkConfig.name);

    try {
      const hash = await deployL2Token({
        address: networkConfig.factory,
        abi: FACTORY_ABI,
        functionName: "createOptimismMintableERC20",
        args: [
          blesAddress,
          `${networkConfig.name} BLES`,
          `${networkConfig.tokenPrefix}BLES`
        ],
        chainId: L2_CHAIN_IDS[network as keyof typeof L2_CHAIN_IDS]
      });

      console.log("Deploy tx hash:", hash);

      const l2Client = createPublicClient({
        chain: network === 'optimism' ? optimismSepolia : baseSepolia,
        transport: http(network === 'optimism' ? 'https://sepolia.optimism.io' : 'https://sepolia.base.org')
      });

      console.log("Waiting for receipt on", networkConfig.name);
      const receipt = await l2Client.waitForTransactionReceipt({ hash });
      console.log("Deploy logs:", receipt.logs);

      const l2TokenAddress = receipt.logs[1]?.topics[1]?.replace("000000000000000000000000", "") as `0x${string}` || "0x";
      console.log("L2 token deployed at:", l2TokenAddress);
      
      console.log("Setting L2 address in store for network:", network);
      setBridgeL2Address(network, l2TokenAddress);
      console.log("Setting bridge step to approve");
      setBridgeStep('approve');
      
      onClose();
      setTimeout(() => {
        notification.success("L2 Token deployed successfully!");
      }, 100);

    } catch (error) {
      console.error("Deploy error:", error);
      notification.error(
        error instanceof Error ? error.message : "Failed to deploy L2 token"
      );
    } finally {
      setIsDeploying(false);
    }
  };

  const handleApprove = async () => {
    try {
      if (chain?.id !== 11155111) {
        await switchChain({ chainId: 11155111 });
        return; 
      }

      setIsApproving(true);
      console.log("Starting approval process...");

      const tx = await approve({
        address: blesAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [
          networkConfig.gateway,
          amount
        ],
        chainId: 11155111
      });

      console.log("Approval tx hash:", tx);
      setApprovalHash(tx);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log("Approval receipt:", receipt);

      if (receipt.status === 'success') {
        setBridgeStep('bridge');
        notification.success("Gateway approved successfully!");
      } else {
        throw new Error("Approval transaction failed");
      }

    } catch (error) {
      console.error("Approve error:", error);
      notification.error(
        error instanceof Error ? error.message : "Failed to approve gateway"
      );
    } finally {
      setIsApproving(false);
    }
  };

  const handleBridge = async () => {
    try {
      setIsBridging(true);
      console.log("allowance",allowance)
      console.log("amount",amount)
      if (chain?.id !== 11155111) {
        await switchChain({ chainId: 11155111 });
        return;
      }

      if (!allowance || parseEther(allowance.toString()) < amount) {
        notification.error("Insufficient allowance. Please approve first.");
        return;
      }

      console.log("Starting bridge process...", {
        gateway: networkConfig.gateway,
        localToken: blesAddress,
        remoteToken: l2TokenAddress,
        amount: amount,
        recipient: address
      });
      const _minGasLimit = 200000;
      const tx = await bridge({
        address: networkConfig.gateway,
        abi: GATEWAY_ABI,
        functionName: "bridgeERC20To",
        args: [
          blesAddress,
          l2TokenAddress!,
          address!,
          amount,
          _minGasLimit,
          "0x"
        ],
        chainId: 11155111
      });

      notification.success(
        <div>
          Transaction submitted
          <a 
            href={`https://sepolia.etherscan.io/tx/${tx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline ml-2"
          >
            View on Etherscan
          </a>
        </div>
      );

      const receipt = await waitForTransactionReceipt(publicClient, { 
        hash: tx
      });

      if (receipt.status === 'success') {
        notification.success(
          <div>
            Tokens bridged successfully! Check them on
            <a 
              href={`${networkConfig.explorerUrl}/address/${l2TokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline ml-2"
            >
              {networkConfig.name} Explorer
            </a>
          </div>
        );
        resetBridgeState();
        onClose();
      }

    } catch (error) {
      console.error("Bridge error:", error);
      if (error instanceof Error && error.message.includes("insufficient funds")) {
        notification.error("Insufficient ETH for gas");
      } else if (error instanceof Error && error.message.includes("user rejected")) {
        notification.error("Transaction rejected");
      } else {
        notification.error(
          error instanceof Error ? error.message : "Failed to bridge tokens"
        );
      }
    } finally {
      setIsBridging(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBridgeAmount(BigInt(e.target.value));
  };

  const hasEnoughAllowance = useMemo(() => {
    if (!allowance || !amount) return false;
    return parseEther(allowance.toString()) >= amount;
  }, [allowance, amount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div ref={modalRef} className="bg-base-200 p-6 rounded-lg w-96 relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Bridge to {networkConfig.name}</h3>
          <button onClick={onClose} className="btn btn-circle btn-ghost btn-xs">✕</button>
        </div>

        {l2TokenAddress ? (
          <>
            {/* L2 Token Display */}
            <div className="bg-base-300 p-3 rounded-lg mb-4 break-all">
              <div className="text-sm font-semibold mb-1">L2 Token Address:</div>
              <a 
                href={`${networkConfig.explorerUrl}/address/${l2TokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm"
              >
                {l2TokenAddress}
              </a>
            </div>

            {/* Bridge Controls */}
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Amount to Bridge</span>
                <span className="label-text-alt">
                  Allowance: {allowance ? formatEther(allowance) : '0'} BLES
                </span>
              </label>
              <input
                type="number"
                value={amount.toString()}
                onChange={handleAmountChange}
                className="input input-bordered w-full"
                placeholder="Enter amount"
              />
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleApprove}
                className="btn btn-primary flex-1"
                disabled={isApproving || !amount}
              >
                {isApproving ? 'Approving...' : 'Approve'}
              </button>

              <button 
                onClick={handleBridge}
                className="btn btn-primary flex-1"
                disabled={isBridging || !hasEnoughAllowance || !amount}
              >
                {isBridging ? 'Bridging...' : 'Bridge'}
              </button>
            </div>
          </>
        ) : (
          /* Deploy Step */
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              First, deploy the L2 token on {networkConfig.name}
            </p>
            {chain?.id !== L2_CHAIN_IDS[network as keyof typeof L2_CHAIN_IDS] ? (
              <button 
                onClick={() => switchChain({ chainId: L2_CHAIN_IDS[network as keyof typeof L2_CHAIN_IDS] })}
                className="btn btn-primary"
              >
                Switch to {networkConfig.name}
              </button>
            ) : (
              <button 
                onClick={handleDeploy}
                className="btn btn-primary"
                disabled={isDeploying}
              >
                {isDeploying ? 'Deploying...' : `Deploy to ${networkConfig.name}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 