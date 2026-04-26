'use client';

import { useAppKitNetwork } from '@reown/appkit/react';
import { getRuntimeConfig } from '@/app/lib/runtime-config';
import { stacksNetworks } from '@/lib/appkit-config';
import { useCallback, useMemo } from 'react';

/**
 * Hook to detect if the connected wallet is on a different network than what the app expects.
 * Returns mismatch status, expected network details, and a function to switch to the correct network.
 */
export function useNetworkMismatch() {
  const { caipNetwork, switchNetwork } = useAppKitNetwork();
  const config = getRuntimeConfig();
  
  // expectedNetwork is 'mainnet' or 'testnet' from NEXT_PUBLIC_NETWORK
  const expectedNetworkType = config.network;
  
  // caipNetwork?.id is usually 'stacks:mainnet' or 'stacks:testnet'
  const currentNetworkId = caipNetwork?.id;
  const expectedNetworkId = expectedNetworkType === 'mainnet' ? 'stacks:mainnet' : 'stacks:testnet';
  
  const isMismatch = useMemo(() => {
    if (!currentNetworkId) return false;
    return currentNetworkId !== expectedNetworkId;
  }, [currentNetworkId, expectedNetworkId]);

  const handleSwitchNetwork = useCallback(async () => {
    const targetNetwork = expectedNetworkType === 'mainnet' ? stacksNetworks.mainnet : stacksNetworks.testnet;
    try {
      await (switchNetwork as any)(targetNetwork);
    } catch (error) {
      console.error('Failed to switch network:', error);
      throw error;
    }
  }, [expectedNetworkType, switchNetwork]);

  return {
    isMismatch,
    expectedNetworkType,
    expectedNetworkName: expectedNetworkType === 'mainnet' ? 'Stacks Mainnet' : 'Stacks Testnet',
    currentNetworkName: caipNetwork?.name || 'Unknown',
    switchNetwork: handleSwitchNetwork,
  };
}
