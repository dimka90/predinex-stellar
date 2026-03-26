/**
 * useWalletConnection - Production hook for wallet connection status
 * Provides real wallet availability and connection state from Stacks context
 */

import { useEffect, useState, useCallback } from 'react';
import { isWalletAvailable, WalletType } from '../lib/wallet-connector';
import { useStacks } from '../components/StacksProvider';

export interface WalletConnectionStatus {
    leather: boolean;
    xverse: boolean;
    walletconnect: boolean;
    hasAnyWallet: boolean;
}

function getWalletStatus(): WalletConnectionStatus {
    const leather = isWalletAvailable('leather');
    const xverse = isWalletAvailable('xverse');
    const walletconnect = isWalletAvailable('walletconnect');
    return { leather, xverse, walletconnect, hasAnyWallet: leather || xverse || walletconnect };
}

export function useWalletConnection(): WalletConnectionStatus {
    // Lazy initializer runs once during the first render — no synchronous setState
    // in an effect needed for the initial check.
    const [status, setStatus] = useState<WalletConnectionStatus>(getWalletStatus);

    useEffect(() => {
        // Recheck periodically in case wallet extensions are installed after mount
        const interval = setInterval(() => setStatus(getWalletStatus()), 2000);
        return () => clearInterval(interval);
    }, []);

    return status;
}

export function useWalletState(): WalletConnectionState {
    const { userData, authenticate, signOut } = useStacks();
    
    const isConnected = !!userData;
    const address = userData?.profile?.stxAddress?.mainnet || null;
    
    const connect = useCallback(() => {
        authenticate();
    }, [authenticate]);
    
    const disconnect = useCallback(() => {
        signOut();
    }, [signOut]);
    
    return { isConnected, address, connect, disconnect };
}
