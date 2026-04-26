'use client';
import { useWallet } from '../../app/components/WalletAdapterProvider';
import { useQuery } from '@tanstack/react-query';

export function useStacksAccount() {
  const { address, isConnected } = useWallet();

  const { data: balance } = useQuery({
    queryKey: ['stx-balance', address],
    queryFn: async () => {
      if (!address) return '0';
      const response = await fetch(`https://api.mainnet.hiro.so/v2/accounts/${address}`);
      const data = await response.json();
      return (parseInt(data.balance) / 1_000_000).toFixed(6);
    },
    enabled: isConnected && !!address,
  });

  return {
    address,
    balance: balance || '0',
    isConnected,
  };
}
