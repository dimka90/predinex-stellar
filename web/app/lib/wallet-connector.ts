/**
 * Wallet Connector - Unified interface for connecting different wallet types
 * Supports Leather, Xverse, and WalletConnect
 */

import { FinishedAuthData, showConnect, UserSession } from '@stacks/connect';
import { handleWalletError, WalletError } from './wallet-errors';

/**
 * Configuration for the Stacks wallet connection
 */
const WALLET_CONFIG = {
    name: 'Predinex',
    icon: typeof window !== 'undefined' ? window.location.origin + '/favicon.ico' : '',
    redirectTo: '/',
};

/**
 * Supported wallet providers for the Predinex platform
 */
export type WalletType = 'leather' | 'xverse' | 'walletconnect';

/**
 * Configuration options for establishing a wallet connection
 */
export interface WalletConnectionOptions {
    /** The specific wallet provider to use */
    walletType: WalletType;
    /** The Stacks UserSession instance to manage the auth state */
    userSession: UserSession;
    /** Callback triggered when the connection is successfully established */
    onFinish?: (authData: FinishedAuthData) => void;
    /** Callback triggered if the user cancels the connection process */
    onCancel?: () => void;
}

/**
 * Initiates the connection flow for a specific wallet type.
 * Dispatches to the appropriate connector based on the provided walletType.
 * 
 * @param options - The connection parameters and callbacks
 * @returns A promise that resolves when the connection process is complete (successfully or cancelled)
 */
export async function connectWallet(options: WalletConnectionOptions): Promise<void> {
    const { walletType, userSession, onFinish, onCancel } = options;

    try {
        switch (walletType) {
            case 'leather':
            case 'xverse':
                await connectExtensionWallet(walletType, userSession, onFinish, onCancel);
                break;
            case 'walletconnect':
                await connectWalletConnect(userSession, onFinish, onCancel);
                break;
            default:
                throw new Error(`Unsupported wallet type: ${walletType}`);
        }
    } catch (error) {
        console.error(`Error connecting to ${walletType}:`, error);
        const walletError = handleWalletError(error, walletType);
        throw walletError;
    }
}

/**
 * Internal helper to handle connections for extension-based wallets (Leather and Xverse).
 * Uses the Stacks Connect library to trigger the browser extension popup.
 * 
 * @param walletType - The type of extension wallet ('leather' or 'xverse')
 * @param userSession - The active session to be updated
 * @param onFinish - Success callback
 * @param onCancel - Cancellation callback
 */
async function connectExtensionWallet(
    walletType: 'leather' | 'xverse',
    userSession: UserSession,
    onFinish?: (authData: FinishedAuthData) => void,
    onCancel?: () => void
): Promise<void> {
    await showConnect({
        appDetails: {
            name: WALLET_CONFIG.name,
            icon: WALLET_CONFIG.icon,
        },
        redirectTo: WALLET_CONFIG.redirectTo,
        userSession,
        onFinish: async (authData) => {
            console.log(`${walletType} authentication finished:`, authData);
            if (onFinish) {
                onFinish(authData);
            }
        },
        onCancel: () => {
            console.log(`User cancelled ${walletType} connection`);
            if (onCancel) {
                onCancel();
            }
        },
    });
}

/**
 * Internal helper to handle connections via the WalletConnect protocol.
 * Suitable for connecting to mobile wallets by displaying a QR code.
 * 
 * @param userSession - The active session to be updated
 * @param onFinish - Success callback
 * @param onCancel - Cancellation callback
 */
async function connectWalletConnect(
    userSession: UserSession,
    onFinish?: (authData: FinishedAuthData) => void,
    onCancel?: () => void
): Promise<void> {
    await showConnect({
        appDetails: {
            name: WALLET_CONFIG.name,
            icon: WALLET_CONFIG.icon,
        },
        redirectTo: WALLET_CONFIG.redirectTo,
        userSession,
        onFinish: async (authData) => {
            console.log('WalletConnect authentication finished:', authData);
            if (onFinish) {
                onFinish(authData);
            }
        },
        onCancel: () => {
            console.log('User cancelled WalletConnect connection');
            if (onCancel) {
                onCancel();
            }
        },
    });
}

/**
 * Verifies if a specific wallet extension is installed and available in the user's browser.
 * 
 * @param walletType - The wallet provider to check for
 * @returns True if the wallet is detected, false otherwise
 */
export function isWalletAvailable(walletType: WalletType): boolean {
    if (typeof window === 'undefined') return false;

    switch (walletType) {
        case 'leather':
            return !!(window as any).LeatherProvider || !!(window as any).stacksProvider;
        case 'xverse':
            return !!(window as any).XverseProvider || !!(window as any).xverse;
        case 'walletconnect':
            return true; // WalletConnect is always available via QR
        default:
            return false;
    }
}

// Plan: Integrate with Hiro Explorer/AppKit enhancements
