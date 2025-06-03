import { useWriteContract, useTransaction, useChainId, useSwitchChain } from "wagmi";

export function MultiChainBridgeButton() {
  const { switchChain } = useSwitchChain();
  
  const targetChains = [
    { id: 901, bridge: "0x..." }, // supersim 901
    { id: 902, bridge: "0x..." }, // supersim 902
    // Add more chains as needed
  ];

  const deployToChain = async (chainId: number, bridge: string) => {
    await switchChain({ chainId });
    // Use same deployment logic as above
  };

  const deployToAllChains = async () => {
    for (const chain of targetChains) {
      await deployToChain(chain.id, chain.bridge);
    }
  };

  return (
    <button 
      onClick={deployToAllChains}
      className="bg-primary text-white px-4 py-2 rounded-lg"
    >
      Deploy to All Chains
    </button>
  );
} 