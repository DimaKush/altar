import { create } from "zustand";
import scaffoldConfig from "~~/scaffold.config";
import { ChainWithAttributes } from "~~/utils/scaffold-eth";

// Define network configs locally since BridgeModal doesn't exist
const NETWORK_CONFIGS = {
  "84532": { name: "Base Sepolia" }, // Base Sepolia
  "11155111": { name: "Sepolia" }, // Ethereum Sepolia  
  "1": { name: "Ethereum" }, // Ethereum Mainnet
  "8453": { name: "Base" }, // Base Mainnet
} as const;

/**
 * Zustand Store
 *
 * You can add global state to the app using this useGlobalState, to get & set
 * values from anywhere in the app.
 *
 * Think about it as a global useState.
 */

type BridgeState = {
  step: 'deploy' | 'approve' | 'bridge';
  deployedL2Addresses: Record<string, `0x${string}`>;
  amount: bigint;
  network?: keyof typeof NETWORK_CONFIGS;
};

type GlobalState = {
  nativeCurrency: {
    price: number;
    isFetching: boolean;
  };
  setNativeCurrencyPrice: (newNativeCurrencyPriceState: number) => void;
  setIsNativeCurrencyFetching: (newIsNativeCurrencyFetching: boolean) => void;
  targetNetwork: ChainWithAttributes;
  setTargetNetwork: (newTargetNetwork: ChainWithAttributes) => void;
  bridge: BridgeState;
  setBridgeStep: (step: BridgeState['step']) => void;
  setBridgeL2Address: (network: string, address: `0x${string}`) => void;
  setBridgeAmount: (amount: bigint) => void;
  setBridgeNetwork: (network: keyof typeof NETWORK_CONFIGS) => void;
  resetBridgeState: () => void;
};

export const useGlobalState = create<GlobalState>(set => ({
  nativeCurrency: {
    price: 0,
    isFetching: true,
  },
  setNativeCurrencyPrice: (newValue: number): void =>
    set(state => ({ nativeCurrency: { ...state.nativeCurrency, price: newValue } })),
  setIsNativeCurrencyFetching: (newValue: boolean): void =>
    set(state => ({ nativeCurrency: { ...state.nativeCurrency, isFetching: newValue } })),
  targetNetwork: scaffoldConfig.targetNetworks[0],
  setTargetNetwork: (newTargetNetwork: ChainWithAttributes) => set(() => ({ targetNetwork: newTargetNetwork })),
  bridge: {
    step: 'deploy',
    amount: 0n,
    deployedL2Addresses: {},
  },
  setBridgeStep: (step) => set((state) => ({ 
    bridge: { ...state.bridge, step } 
  })),
  setBridgeL2Address: (network: string, address: `0x${string}`) => set((state) => ({ 
    bridge: { 
      ...state.bridge, 
      deployedL2Addresses: {
        ...state.bridge.deployedL2Addresses,
        [network]: address
      }
    } 
  })),
  setBridgeAmount: (amount) => set((state) => ({ 
    bridge: { ...state.bridge, amount } 
  })),
  setBridgeNetwork: (network) => set((state) => ({ 
    bridge: { ...state.bridge, network } 
  })),
  resetBridgeState: () => set((state) => ({ 
    bridge: { 
      step: 'deploy', 
      amount: 0n,
      deployedL2Addresses: state.bridge.deployedL2Addresses
    } 
  })),
}));
