import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { sepolia, foundry, optimismSepolia, baseSepolia, scrollSepolia } from "viem/chains";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";

const enabledChains = [sepolia, foundry, optimismSepolia, baseSepolia, scrollSepolia] as const;

export const wagmiConfig = getDefaultConfig({
  appName: "Scaffold-ETH 2 App",
  projectId: scaffoldConfig.walletConnectProjectId,
  chains: enabledChains,
  transports: {
    [sepolia.id]: http(getAlchemyHttpUrl(sepolia.id)),
    [foundry.id]: http("http://localhost:8545"),
    [optimismSepolia.id]: http(getAlchemyHttpUrl(optimismSepolia.id)),
    [baseSepolia.id]: http(getAlchemyHttpUrl(baseSepolia.id)),
    [scrollSepolia.id]: http(getAlchemyHttpUrl(scrollSepolia.id)),
  },
  ssr: false,
});
