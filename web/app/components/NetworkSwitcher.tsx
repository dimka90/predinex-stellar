'use client';

import { useAppKitNetwork } from '@reown/appkit/react';
import { useWallet } from './WalletAdapterProvider';
import { Globe, Check, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { NetworkType } from '@/app/lib/wallet-service';
import { stacksNetworks } from '@/lib/appkit-config';

export function NetworkSwitcher() {
  const { switchNetwork, caipNetwork } = useAppKitNetwork();
  const { isConnected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isConnected) {
    return null;
  }

  const currentNetwork = caipNetwork?.name?.toLowerCase().includes('testnet') ? 'testnet' : 'mainnet';

  const handleNetworkSwitch = async (network: NetworkType) => {
    if (network === currentNetwork) return;

    setIsLoading(true);
    setError(null);

    try {
      const targetNetwork = network === 'mainnet' ? stacksNetworks.mainnet : stacksNetworks.testnet;
      // @ts-expect-error – stacksNetworks returns a Stacks-specific CaipNetwork shape that
      // is structurally compatible with AppKit's switchNetwork parameter but not
      // assignable to its declared CaipNetwork union type.
      await switchNetwork(targetNetwork);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network switch failed';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-muted-foreground" />
      <select
        value={currentNetwork}
        onChange={e => handleNetworkSwitch(e.target.value as NetworkType)}
        disabled={isLoading}
        className="bg-muted rounded p-1 text-sm"
      >
        <option value="mainnet">Mainnet</option>
        <option value="testnet">Testnet</option>
      </select>

      {error && (
        <div className="flex items-center gap-1 text-red-500 text-xs">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}
