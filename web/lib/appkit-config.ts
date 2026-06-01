/**
 * Reown AppKit Configuration
 *
 * Defines the Stellar network metadata used to initialise AppKit and the
 * supporting wallet UI (network switcher, mismatch warning).
 *
 * Supported networks
 * ------------------
 * - Stellar Public Network ("mainnet"), CAIP-2 id `stellar:pubnet`
 * - Stellar Test Network ("testnet"),  CAIP-2 id `stellar:testnet`
 *
 * AppKit does not currently ship a first-party Stellar adapter, so these
 * objects are plain CAIP-network descriptors. They are intentionally free of
 * any Stacks chain ids — Predinex is a Stellar/Soroban app, and routing the
 * provider through `stacks:*` ids would put the wallet UI on the wrong network
 * (see issue #210).
 */

export type StellarNetworkKey = 'mainnet' | 'testnet';

export interface StellarCaipNetwork {
  id: `stellar:${string}`;
  chainNamespace: 'stellar';
  caipNetworkId: `stellar:${string}`;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: {
    default: { http: readonly string[] };
    public: { http: readonly string[] };
  };
  blockExplorers: {
    default: { name: string; url: string };
  };
}

export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'cbb72cc85764d1cd3b664790089a8fab';

export const stellarNetworks: Record<StellarNetworkKey, StellarCaipNetwork> = {
  mainnet: {
    id: 'stellar:pubnet',
    chainNamespace: 'stellar',
    caipNetworkId: 'stellar:pubnet',
    name: 'Stellar Mainnet',
    nativeCurrency: {
      name: 'Stellar Lumens',
      symbol: 'XLM',
      decimals: 7,
    },
    rpcUrls: {
      default: { http: ['https://mainnet.stellar.validationcloud.io/v1/soroban/rpc'] },
      public: { http: ['https://mainnet.stellar.validationcloud.io/v1/soroban/rpc'] },
    },
    blockExplorers: {
      default: { name: 'Stellar Expert', url: 'https://stellar.expert/explorer/public' },
    },
  },
  testnet: {
    id: 'stellar:testnet',
    chainNamespace: 'stellar',
    caipNetworkId: 'stellar:testnet',
    name: 'Stellar Testnet',
    nativeCurrency: {
      name: 'Stellar Lumens',
      symbol: 'XLM',
      decimals: 7,
    },
    rpcUrls: {
      default: { http: ['https://soroban-testnet.stellar.org'] },
      public: { http: ['https://soroban-testnet.stellar.org'] },
    },
    blockExplorers: {
      default: { name: 'Stellar Expert', url: 'https://stellar.expert/explorer/testnet' },
    },
  },
};

export const SUPPORTED_NETWORK_IDS = [
  stellarNetworks.mainnet.id,
  stellarNetworks.testnet.id,
] as const;

export type SupportedNetworkId = (typeof SUPPORTED_NETWORK_IDS)[number];

export const appKitMetadata = {
  name: 'Predinex',
  description: 'Decentralized Prediction Markets on Stellar',
  url: 'https://predinex.io',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};
