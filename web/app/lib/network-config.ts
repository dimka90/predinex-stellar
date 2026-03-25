/**
 * Network configuration types and constants
 */

export type NetworkType = 'mainnet' | 'testnet' | 'devnet';

export interface NetworkInfo {
  apiUrl: string;
  explorerUrl: string;
}

export const NETWORK_CONFIG: Record<NetworkType, NetworkInfo> = {
  mainnet: {
    apiUrl: 'https://api.mainnet.hiro.so',
    explorerUrl: 'https://explorer.hiro.so',
  },
  testnet: {
    apiUrl: 'https://api.testnet.hiro.so',
    explorerUrl: 'https://explorer.hiro.so?chain=testnet',
  },
  devnet: {
    apiUrl: 'http://localhost:3999',
    explorerUrl: 'http://explorer.hiro.so?chain=testnet',
  },
};

/**
 * Default network for the application.
 * Priority: process.env.NEXT_PUBLIC_NETWORK > 'testnet'
 */
export const DEFAULT_NETWORK: NetworkType = 
  (process.env.NEXT_PUBLIC_NETWORK as NetworkType) || 'testnet';

/**
 * Gets the network configuration for a given network type.
 * Returns null if the configuration is missing to allow for safe error handling.
 */
export function getNetworkInfo(networkType: NetworkType = DEFAULT_NETWORK): NetworkInfo | null {
  return NETWORK_CONFIG[networkType] || null;
}
