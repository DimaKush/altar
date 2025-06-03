import { useEffect, useState } from "react";
import { useWriteContract, useWatchContractEvent, useSimulateContract, useChainId, useConfig, useAccount, usePublicClient, useSwitchChain } from "wagmi";
import { encodeFunctionData, parseAbi, concat, encodeAbiParameters, decodeAbiParameters, hexToBytes, bytesToHex, concat as concatBytes, getAddress } from "viem";
import { Address } from "~~/components/scaffold-eth";
import { AddressInput } from "~~/components/scaffold-eth/Input/AddressInput";
import { BytesInput } from "~~/components/scaffold-eth/Input/BytesInput";
import { InputBase } from "~~/components/scaffold-eth";
import SuperblesArtifact from "../../artifacts/Superbles.json";
import scaffoldConfig from "~~/scaffold.config";

const CREATE_X_ADDRESS = "0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed" as const;
const SUPERCHAIN_BYTECODE = SuperblesArtifact.bytecode.object as `0x${string}`;

const createXAbi = parseAbi([
  "function deployCreate2(bytes32 salt, bytes initCode) external payable returns (address)",
  "function computeCreate2Address(bytes32 salt, bytes32 initCodeHash) external view returns (address)",
]);

interface BridgeButtonProps {
  onSuccess?: (address: string, chainId: number) => void;
  blesAddress?: string;
  onClose?: () => void;
}

const generateSalt = (address: `0x${string}`) => {
  // First 20 bytes: sender address (already in hex format)
  const senderBytes = hexToBytes(address);
  
  // 21st byte: 0x00 to DISABLE cross-chain protection
  const protectionByte = new Uint8Array([0x00]);
  
  // Last 11 bytes: random entropy
  const randomBytes = crypto.getRandomValues(new Uint8Array(11));
  
  // Concatenate all parts
  const saltBytes = concatBytes([senderBytes, protectionByte, randomBytes]);
  return bytesToHex(saltBytes) as `0x${string}`;
};

interface TokenParams {
  bridge: string;
  remoteToken: string | undefined;
  name: string;
  symbol: string;
  decimals: string;
  salt: `0x${string}`;
}

interface SuperblesDeployment {
  chain_id: number;
  l2_token: string;
  deployer: string;
  salt: string;
  created_at: number;
}

export function BridgeButton({ onSuccess, blesAddress, onClose }: BridgeButtonProps) {
  const config = useConfig();
  const { address: account } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  
  // State
  const [existingSalt, setExistingSalt] = useState<`0x${string}` | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string>();
  const [existingDeployments, setExistingDeployments] = useState<SuperblesDeployment[]>([]);
  const [isLoadingDeployments, setIsLoadingDeployments] = useState(false);

  // Modify initial state to use existing salt if available
  const [tokenParams, setTokenParams] = useState<TokenParams>({
    bridge: "0x4200000000000000000000000000000000000010",
    remoteToken: blesAddress,
    name: "BLES",
    symbol: "BLES",
    decimals: "18",
    salt: "0x" as `0x${string}` // Initialize with empty salt
  });

  const [verificationStatus, setVerificationStatus] = useState<{
    inProgress: boolean;
    success?: boolean;
    error?: string;
    url?: string;
  }>({ inProgress: false });

  // First, add error state to track simulation errors
  const [simulationError, setSimulationError] = useState<string>();

  // Fetch existing deployments and salt from API
  useEffect(() => {
    const fetchExistingDeployments = async () => {
      if (!blesAddress || !account) return;
      
      setIsLoadingDeployments(true);
      try {
        const response = await fetch(`/api/superbles/${blesAddress}`);
        if (response.ok) {
          const deployments = await response.json() as SuperblesDeployment[];
          console.log("API returned deployments:", deployments);
          setExistingDeployments(deployments);
          
          // Find any deployment with a salt - this will be our source of truth
          const deploymentWithSalt = deployments.find(d => d.salt && d.deployer.toLowerCase() === account.toLowerCase());
          if (deploymentWithSalt?.salt) {
            const salt = deploymentWithSalt.salt as `0x${string}`;
            setExistingSalt(salt);
            setTokenParams(prev => ({ ...prev, salt }));
            console.log(`Using existing salt from L2 deployment on chain ${deploymentWithSalt.chain_id}: ${salt}`);
          } else if (account) {
            // Only generate new salt if we don't have any existing deployments
            const newSalt = generateSalt(account as `0x${string}`);
            setTokenParams(prev => ({ ...prev, salt: newSalt }));
            console.log(`Generated new salt for first deployment: ${newSalt}`);
          }
        }
      } catch (error) {
        console.error('Failed to fetch existing deployments:', error);
        // Generate new salt only if we failed to get existing deployments
        if (account) {
          const newSalt = generateSalt(account as `0x${string}`);
          setTokenParams(prev => ({ ...prev, salt: newSalt }));
          console.log(`Generated new salt after error: ${newSalt}`);
        }
      } finally {
        setIsLoadingDeployments(false);
      }
    };
    
    fetchExistingDeployments();
  }, [blesAddress, account]);

  const getInitCode = ({
    bridge,
    remoteToken
  }: {
    bridge: `0x${string}`;
    remoteToken: `0x${string}`;
  }) => {
    const bytecode = SUPERCHAIN_BYTECODE;

    const encodedParams = encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" }
      ],
      [bridge, remoteToken]
    );

    return concat([bytecode, encodedParams]) as `0x${string}`;
  };

  // Modify the simulation to include error handling and logging
  const { data: simulateData, error: simulateError } = useSimulateContract({
    address: CREATE_X_ADDRESS,
    abi: createXAbi,
    functionName: 'deployCreate2',
    args: tokenParams.salt && tokenParams.bridge && tokenParams.remoteToken ? [
      tokenParams.salt,
      getInitCode({
        bridge: tokenParams.bridge as `0x${string}`,
        remoteToken: tokenParams.remoteToken as `0x${string}`,
      })
    ] : undefined,
    query: {
      enabled: !!account && !!tokenParams.bridge && !!tokenParams.remoteToken,
    }
  });

  // Add error effect
  useEffect(() => {
    if (simulateError) {
      console.error("Simulation error:", simulateError);
      // Показываем ошибку симуляции только если нет успешного деплоя
      if (!deployedAddress) {
        setSimulationError(simulateError.message);
      }
    }
  }, [simulateError, deployedAddress]);

  // Отправка транзакции
  const { writeContract, data: hash, isPending, isSuccess } = useWriteContract();

  const handleDeploy = async (targetChainId?: number) => {
    try {
      if (!account || !tokenParams.bridge || !tokenParams.remoteToken) {
        alert("Please connect wallet and fill all required fields");
        return;
      }

      // If a target chain is specified and it's different from the current chain, switch to it
      if (targetChainId && targetChainId !== chainId) {
        await switchChain({ chainId: targetChainId });
        return; // The chain switch will trigger a re-render, so we'll return here
      }

      if (!simulateData?.request) {
        alert("Cannot simulate transaction. Please check your parameters and try again.");
        return;
      }

      // Check if we have existing deployments but using a different salt
      if (existingSalt && tokenParams.salt !== existingSalt) {
        if (!confirm(
          "WARNING: You are using a different salt than your previous deployments. " +
          "This will result in DIFFERENT contract addresses across chains. " +
          "Are you sure you want to continue?"
        )) {
          return;
        }
      }

      const initCode = getInitCode({
        bridge: tokenParams.bridge as `0x${string}`,
        remoteToken: tokenParams.remoteToken as `0x${string}`,
      });

      console.log("Using salt for deployment:", tokenParams.salt);

      console.log("Deployment parameters:", {
        salt: tokenParams.salt,
        initCode,
        bridge: tokenParams.bridge,
        remoteToken: tokenParams.remoteToken,
        chainId,
        account
      });

      writeContract(simulateData.request);

    } catch (error) {
      console.error("Deploy error:", error);
      alert(`Deploy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Modify the handleSaltChange function to keep track of user modifications
  const handleSaltChange = (value: string) => {
    // Only allow manual changes if user explicitly clicked generate new salt button
    if (!existingSalt || confirm("Are you sure you want to modify the salt? This will result in different contract addresses across chains.")) {
      setTokenParams(prev => ({
        ...prev,
        salt: value.startsWith('0x') ? value as `0x${string}` : `0x${value}` as `0x${string}`
      }));
    }
  };

  // Add handler for generating new salt with confirmation
  const handleGenerateNewSalt = () => {
    if (!account) return;
    
    // Ask for confirmation if we already have an existing salt
    if (existingSalt && !confirm("Are you sure you want to generate a new salt? This will result in different contract addresses across chains.")) {
      return;
    }
    
    const newSalt = generateSalt(account as `0x${string}`);
    setTokenParams(prev => ({ ...prev, salt: newSalt }));
    setExistingSalt(null);
    console.log("Generated new salt:", newSalt);
  };

  // Отслеживаем событие создания контракта
  useWatchContractEvent({
    address: CREATE_X_ADDRESS,
    abi: createXAbi,
    eventName: 'ContractCreation',
    onLogs: logs => {
      console.log('Contract created:', logs);
    },
  });

  // Добавим логирование
  useEffect(() => {
    console.log("Contract write state:", {
      canWrite: !!simulateData?.request,
      isPending,
      isSuccess,
      hash,
      chainId,
      account,
      tokenParams: {
        bridge: !!tokenParams.bridge,
        remoteToken: !!tokenParams.remoteToken
      }
    });
  }, [simulateData, isPending, isSuccess, hash, chainId, account, tokenParams]);

  useEffect(() => {
    if (hash) {
      console.log("New transaction hash received:", hash);
    }
  }, [hash]);

  useEffect(() => {
    console.log("Transaction status updated:", { 
      isPending, 
      isSuccess, 
      hash,
      chainId,
      account 
    });
  }, [isPending, isSuccess, hash, chainId, account]);

  useEffect(() => {
    if (isSuccess && hash && publicClient) {
      const verify = async () => {
        try {
          console.log("Starting verification process for tx:", hash);
          
          const receipt = await publicClient.waitForTransactionReceipt({ 
            hash,
            confirmations: 2,
            timeout: 60_000
          });
          
          console.log("Transaction receipt:", receipt);

          // Find the ContractCreation event from CreateX contract
          const createEvent = receipt.logs.find(log => 
            log.address.toLowerCase() === CREATE_X_ADDRESS.toLowerCase() &&
            log.topics[0] === '0xb8fda7e00c6b06a2b54e58521bc5894fee35f1090e5a3bb6390bfe2b98b497f7'
          );

          if (!createEvent || !createEvent.topics[1]) {
            throw new Error("Contract creation event not found");
          }

          // Get deployed contract address from the event topic
          const contractAddress = getAddress(`0x${createEvent.topics[1].slice(26)}`);
          console.log("Deployed contract address from event:", contractAddress);
          
          // Save the deployed address and update state
          setDeployedAddress(contractAddress);
          
          // Call the onSuccess callback with the new contract address
          onSuccess?.(contractAddress, chainId);

          // Check if verification status is already set to prevent multiple requests
          if (verificationStatus.inProgress || verificationStatus.success) {
            console.log("Verification already in progress or completed, skipping");
            return;
          }

          setVerificationStatus({ inProgress: true });
          
          const encodedArgs = encodeAbiParameters(
            [
              { type: 'address' },
              { type: 'address' }
            ],
            [
              tokenParams.bridge as `0x${string}`,
              tokenParams.remoteToken as `0x${string}`
            ]
          );

          console.log("Encoded constructor arguments:", encodedArgs);

          const response = await fetch('/api/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              address: contractAddress,
              constructorArguments: encodedArgs,
              chainId
            })
          });

          // Log the raw response for debugging
          const responseText = await response.text();
          console.log("Raw verification response:", responseText);

          let data;
          try {
            data = JSON.parse(responseText);
          } catch (e) {
            console.error("Failed to parse verification response:", e);
            setVerificationStatus({
              inProgress: false,
              success: false,
              error: `Invalid response from server: ${responseText}`
            });
            return;
          }

          if (!response.ok) {
            throw new Error(data.error || 'Verification request failed');
          }

          setVerificationStatus({
            inProgress: false,
            success: true,
            url: data.explorerUrl
          });

        } catch (error) {
          console.error("Verification error:", error);
          setVerificationStatus({
            inProgress: false,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      };

      verify();
    }
  }, [isSuccess, hash, chainId, tokenParams, publicClient, onSuccess, verificationStatus.inProgress, verificationStatus.success]);

  const getExplorerUrl = (chainId: number, hash?: string) => {
    const baseUrl = {
      11155111: "https://sepolia.etherscan.io",
      10: "https://optimistic.etherscan.io", 
      8453: "https://basescan.org",
      11155420: "https://sepolia-optimistic.etherscan.io",
      84532: "https://sepolia.basescan.org"
    }[chainId] || "https://etherscan.io";

    return hash ? `${baseUrl}/tx/${hash}` : baseUrl;
  };

  // Function to get network name based on chainId
  const getNetworkName = (chainId: number) => {
    const network = scaffoldConfig.targetNetworks.find(n => n.id === chainId);
    return network?.name || `Chain ID ${chainId}`;
  };

  // Check if a chain already has a deployment
  const isChainDeployed = (chainId: number) => {
    return existingDeployments.some(d => d.chain_id === chainId);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Existing Deployments */}
      {existingDeployments.length > 0 && (
        <div className="mb-4 p-4 border rounded-lg bg-base-200">
          <h3 className="text-lg font-semibold mb-2">Existing Deployments</h3>
          <div className="overflow-x-auto">
            <table className="table-auto w-full">
              <thead>
                <tr className="text-sm text-base-content/70">
                  <th className="text-left py-2">Chain</th>
                  <th className="text-left py-2">Address</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {existingDeployments.map((deployment) => (
                  <tr key={deployment.chain_id} className="border-t border-base-300">
                    <td className="py-2">{getNetworkName(deployment.chain_id)}</td>
                    <td className="py-2">
                      <Address address={deployment.l2_token} size="sm" />
                    </td>
                    <td className="py-2">
                      <a 
                        href={`${getExplorerUrl(deployment.chain_id)}/address/${deployment.l2_token}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline"
                      >
                        View on Explorer
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {existingSalt && (
            <div className="mt-2 text-sm text-info">
              Using saved salt from previous deployment. This ensures same address across all chains.
            </div>
          )}
        </div>
      )}

      {isLoadingDeployments && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span className="ml-2">Loading existing deployments...</span>
        </div>
      )}

      {/* Chain Selection Cards */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Select Chain to Deploy Bridge Token</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {scaffoldConfig.targetNetworks.map(network => (
            <div 
              key={network.id}
              onClick={() => !deployedAddress && handleDeploy(network.id)}
              className={`p-4 border rounded-lg 
                ${!deployedAddress ? 'cursor-pointer hover:bg-primary/10' : 'opacity-70'} 
                ${isChainDeployed(network.id) ? 'bg-success/10 border-success/30' : ''}
                transition-colors flex flex-col items-center justify-center gap-2`}
            >
              <div className="font-medium">{network.name}</div>
              {chainId === network.id && (
                <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full">Current</span>
              )}
              {isChainDeployed(network.id) && (
                <span className="text-xs px-2 py-1 bg-success/20 text-success rounded-full">Deployed</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Settings Dropdown */}
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full p-3 flex justify-between items-center bg-base-200"
        >
          <span className="font-medium">Advanced Settings</span>
          <span>{showAdvanced ? '▲' : '▼'}</span>
        </button>
        
        {showAdvanced && (
          <div className="p-4 grid gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Bridge Address</label>
              <AddressInput
                name="bridge"
                value={tokenParams.bridge}
                placeholder="Bridge Address (0x...)"
                onChange={(value) => setTokenParams(prev => ({ ...prev, bridge: value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Remote Token Address</label>
              <AddressInput
                name="remoteToken"
                value={tokenParams.remoteToken || ""}
                placeholder="Remote Token Address (0x...)"
                onChange={(value) => setTokenParams(prev => ({ ...prev, remoteToken: value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Token Name</label>
              <InputBase
                name="name"
                value={tokenParams.name}
                placeholder="Token Name"
                onChange={(value) => setTokenParams(prev => ({ ...prev, name: value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Token Symbol</label>
              <InputBase
                name="symbol"
                value={tokenParams.symbol}
                placeholder="Token Symbol"
                onChange={(value) => setTokenParams(prev => ({ ...prev, symbol: value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Decimals</label>
              <InputBase
                name="decimals"
                value={tokenParams.decimals}
                placeholder="Decimals"
                onChange={(value) => setTokenParams(prev => ({ ...prev, decimals: value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Salt</label>
              <div className="flex flex-col gap-2">
                <div className="flex-1">
                  <BytesInput
                    name="salt"
                    value={tokenParams.salt}
                    placeholder="Salt for CREATE2"
                    onChange={handleSaltChange}
                  />
                </div>
                <button
                  onClick={handleGenerateNewSalt}
                  type="button"
                  className="btn btn-secondary"
                  disabled={!account}
                >
                  Generate New Salt
                </button>
              </div>
              {existingSalt && (
                <div className="text-sm flex items-center gap-2 mt-1 p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span className="text-blue-700">
                    Using salt from previous deployment. <strong>Do not change this</strong> to ensure the same address across all chains.
                  </span>
                </div>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Salt format: [20 bytes address][1 byte protection (0x00)][11 bytes entropy]. 
                Cross-chain protection is disabled to ensure same address across chains.
                The same salt must be used across all chains for the same token.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Deployment Status Section */}
      {isPending && (
        <div className="my-4 p-4 border rounded-lg bg-yellow-50">
          <div className="flex items-center gap-2 mb-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600" />
            <span className="font-medium">Deploying to {getNetworkName(chainId)}...</span>
          </div>
          <p className="text-sm text-gray-600">Please wait while your transaction is being processed</p>
        </div>
      )}

      {deployedAddress && (
        <div className="my-4 p-4 border rounded-lg bg-green-50">
          <div className="flex flex-col gap-3">
            <div className="font-medium text-green-700">
              Successfully deployed to {getNetworkName(chainId)}!
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Contract Address:</span> 
              <Address address={deployedAddress} size="sm" />
              <a 
                href={`${getExplorerUrl(chainId)}/address/${deployedAddress}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 underline"
              >
                View on Explorer
              </a>
            </div>

            {hash && (
              <div>
                <a 
                  href={getExplorerUrl(chainId, hash)}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline"
                >
                  View Transaction
                </a>
              </div>
            )}
            
            {verificationStatus.inProgress && (
              <div className="flex items-center gap-2 text-yellow-600 text-sm">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-600" />
                Verifying contract...
              </div>
            )}
            
            {verificationStatus.success && (
              <div className="text-green-600 text-sm">
                Contract verified! <a href={verificationStatus.url} target="_blank" rel="noopener noreferrer" className="underline">View verified contract</a>
              </div>
            )}
            
            {verificationStatus.error && (
              <div className="text-red-600 text-sm">
                Verification failed: {verificationStatus.error}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!deployedAddress && (
          <button 
            onClick={() => handleDeploy()}
            disabled={isPending || !tokenParams.bridge || !tokenParams.remoteToken || !simulateData}
            className="bg-primary text-white px-4 py-2 rounded-lg disabled:opacity-50 flex-1 flex items-center justify-center gap-2"
          >
            {isPending ? "Deploying..." : "Deploy on Current Chain"}
          </button>
        )}

        {deployedAddress && (
          <button
            onClick={onClose}
            className="bg-green-600 text-white px-4 py-2 rounded-lg w-full"
          >
            Done
          </button>
        )}
      </div>
      
      {simulationError && !deployedAddress && (
        <div className="text-red-500">
          Simulation failed: {simulationError}
        </div>
      )}
    </div>
  );
}
