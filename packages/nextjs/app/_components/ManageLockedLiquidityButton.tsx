import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { ChainWithAttributes } from "~~/utils/scaffold-eth";

export const ManageLockedLiquidityButton = ({ pairStreamId, targetNetwork }: { pairStreamId: number, targetNetwork: ChainWithAttributes }) => {
    const url = `https://app.sablier.com/vesting/stream/LL3-${targetNetwork.id}-${pairStreamId}/`;
  return <button onClick={() => window.open(url, '_blank')} className="btn btn-primary">Manage Locked Liquidity</button>;
};