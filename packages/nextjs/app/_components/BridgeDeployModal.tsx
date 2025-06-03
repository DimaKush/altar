import { XMarkIcon } from "@heroicons/react/24/outline";
import { BridgeButton } from "./bridgeButton";
import { useGlobalState } from "~~/services/store/store";

export interface BridgeDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  blesAddress?: string;
}

export const BridgeDeployModal = ({ isOpen, onClose, blesAddress }: BridgeDeployModalProps) => {
  const { setBridgeL2Address } = useGlobalState();

  const handleDeploySuccess = (address: string, chainId: number) => {
    console.log(`Bridge token deployed successfully at ${address} on chain ${chainId}`);
    // Update global state with the deployed address
    setBridgeL2Address(chainId.toString(), address as `0x${string}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30" 
        onClick={onClose}
        aria-hidden="true" 
      />
      
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-base-200 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative my-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-medium">
              Deploy Bridge Token
            </h2>
            <button
              type="button"
              className="p-1 rounded-md hover:bg-base-300"
              onClick={onClose}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          
          <p className="text-base-content/70 mb-4">
            Deploy a standard SuperToken that can be bridged across chains. The token will be compatible with the OP Stack bridge system.
          </p>
          
          <BridgeButton 
            blesAddress={blesAddress}
            onSuccess={handleDeploySuccess}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}; 