export const APP_NAME = "Predinex";
export const REWARDS_VERSION = "v1.0";

export const CONTRACT_ADDRESS = "SP2W_EJMBN";
export const CONTRACT_NAME = "predinex-pool-1771470759824";

export const DEFAULT_NETWORK = 'mainnet';

export const STACKS_API_BASE_URL = 'https://api.mainnet.hiro.so';

export const NETWORK_CONFIG = {
  mainnet: {
    stacksApiUrl: 'https://api.mainnet.hiro.so',
    explorerUrl: 'https://stellar.expert/explorer/mainnet/tx',
    network: 'mainnet',
  },
  testnet: {
    stacksApiUrl: 'https://api.testnet.hiro.so',
    explorerUrl: 'https://stellar.expert/explorer/testnet/tx',
    network: 'testnet',
  },
} as const;

export type NetworkType = keyof typeof NETWORK_CONFIG;
