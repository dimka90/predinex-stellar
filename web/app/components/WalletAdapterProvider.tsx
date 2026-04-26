'use client';

import type { UserData } from '@stacks/connect';
import { ReactNode, createContext, useContext, useMemo } from 'react';
import { StacksProvider, useStacks } from './StacksProvider';
import { WalletClient } from '../lib/wallet-adapter';

const WalletContext = createContext<WalletClient | undefined>(undefined);

function getStxAddressFromUserData(userData: UserData | null | undefined): string | null {
  const mainnet = userData?.profile?.stxAddress?.mainnet;
  const testnet = userData?.profile?.stxAddress?.testnet;
  const identityAddress = userData?.identityAddress;
  return mainnet || testnet || identityAddress || null;
}

function WalletAdapterBridge({ children }: { children: ReactNode }) {
  const { userData, authenticate, signOut, isLoading } = useStacks();

  const value: WalletClient = useMemo(() => {
    const address = getStxAddressFromUserData(userData);
    return {
      chain: 'stacks',
      isLoading,
      isConnected: !!userData && !!address,
      address,
      connect: authenticate,
      disconnect: signOut,
    };
  }, [userData, authenticate, signOut, isLoading]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/**
 * WalletAdapterProvider
 * - Default implementation: uses the existing `StacksProvider` + `useStacks` hook.
 * - Alternate implementation: pass a `value` prop in tests/stories to swap adapters.
 */
export function WalletAdapterProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: WalletClient;
}) {
  if (value) {
    return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
  }

  return (
    <StacksProvider>
      <WalletAdapterBridge>{children}</WalletAdapterBridge>
    </StacksProvider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within a WalletAdapterProvider');
  }
  return ctx;
}

