import { useState, useEffect } from "react";

const INDEXER_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://134-209-152-255.sslip.io/api';

export interface SuperbleDeployment {
  chain_id: number;
  l2_token: string;
  deployer: string;
  salt: string;
  created_at: number;
}

interface SuperblesData {
  deployments: SuperbleDeployment[];
  isLoading: boolean;
  error: Error | null;
  refetch: (address: string) => Promise<void>;
}

export const useSuperbles = (address?: string): SuperblesData => {
  const [deployments, setDeployments] = useState<SuperbleDeployment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSuperbles = async (fetchAddress: string) => {
    if (!fetchAddress || !fetchAddress.startsWith('0x') || fetchAddress.length !== 42) {
      setError(new Error('Invalid address format'));
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('Fetching superbles from:', `${INDEXER_API_URL}/superbles/${fetchAddress}`);
      
      const response = await fetch(`${INDEXER_API_URL}/superbles/${fetchAddress}`);
      
      if (!response.ok) {
        throw new Error(`Indexer API returned status ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Superbles data:', data);
      
      setDeployments(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      console.error('Error fetching superbles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (address) {
      fetchSuperbles(address);
    }
  }, [address]);

  return {
    deployments,
    isLoading,
    error,
    refetch: fetchSuperbles
  };
}; 