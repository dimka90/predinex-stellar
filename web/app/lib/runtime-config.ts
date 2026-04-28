import { WALLETCONNECT_CONFIG } from './walletconnect-config';
import { NETWORK_CONFIG as ANALYTICS_NETWORK_CONFIG } from './analytics/config';
import { validateStellarContractAddress } from './validators';

export type SupportedNetwork = 'mainnet' | 'testnet';

export type ContractConfig = {
  /** Contract address (principal) used as `contractAddress` in Stacks contract calls. */
  address: string;
  /** Contract name used as `contractName` in Stacks contract calls. */
  name: string;
  /** Full contract id in `<address>.<name>` form. */
  id: string;
};

export type StacksApiConfig = {
  /** Hiro Core API base URL used for chain tip / tx / address endpoints. */
  coreApiUrl: string;
  /** Explorer base URL (for linking). */
  explorerUrl: string;
  /** RPC URL (for wallet/rpc integrations). */
  rpcUrl: string;
};

export type SorobanConfig = {
  /** Soroban RPC URL used for getEvents and other Soroban RPC calls. */
  rpcUrl: string;
  /** Stellar explorer base URL (for linking to transactions). */
  explorerUrl: string;
  /** Deployed Soroban contract ID (C... strkey). */
  contractId: string;
};

export type RuntimeConfig = {
  network: SupportedNetwork;
  contract: ContractConfig;
  api: StacksApiConfig;
  soroban: SorobanConfig;
};

function getRequiredEnv(name: string): string {
  const env =
    typeof process !== 'undefined' && process.env ? process.env[name] : undefined;
  if (!env) {
    throw new Error(`Missing required config: ${name}. Set ${name} to 'mainnet' or 'testnet'.`);
  }
  return env;
}

function parseNetwork(raw: string): SupportedNetwork {
  const v = raw.trim().toLowerCase();
  if (v === 'mainnet' || v === 'testnet') return v;
  throw new Error(`Invalid config NEXT_PUBLIC_NETWORK='${raw}'. Expected 'mainnet' or 'testnet'.`);
}

function parseContractId(contractAddress: string): { address: string; name: string; id: string } {
  // For Stellar, we use the contract address directly as the ID
  // Stellar contracts don't have separate names like Stacks contracts
  const address = contractAddress.trim();
  const name = 'contract'; // Default name for Stellar contracts
  const id = address;
  return { address, name, id };
}

let cachedConfig: RuntimeConfig | null = null;

/**
 * Typed runtime config (contract, network selection, API endpoints).
 *
 * Fail-fast behavior:
 * - Throws if `NEXT_PUBLIC_NETWORK` is missing or invalid.
 * - Throws if derived contract/API configuration cannot be resolved.
 */
export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) return cachedConfig;

  const network = parseNetwork(getRequiredEnv('NEXT_PUBLIC_NETWORK'));

  const walletNet = WALLETCONNECT_CONFIG.networks[network];
  if (!walletNet?.coreApiUrl || !walletNet?.explorerUrl || !walletNet?.rpcUrl) {
    throw new Error(`Missing Stacks API URLs for network '${network}' in wallet configuration.`);
  }

  const sorobanNet = WALLETCONNECT_CONFIG.soroban[network];
  if (!sorobanNet?.rpcUrl || !sorobanNet?.explorerUrl) {
    throw new Error(`Missing Soroban RPC URLs for network '${network}' in wallet configuration.`);
  }

  // Soroban contract ID — prefer explicit env var, fall back to analytics config
  const sorobanContractId =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SOROBAN_CONTRACT_ID) || '';

  const analyticsKey = network === 'mainnet' ? 'MAINNET' : 'TESTNET';
  const contractIdFromAnalytics = (ANALYTICS_NETWORK_CONFIG as any)?.[analyticsKey]?.CONTRACT_ADDRESS;
  if (!contractIdFromAnalytics || typeof contractIdFromAnalytics !== 'string') {
    throw new Error(
      `Missing contract id for network '${network}'. Expected it in analytics NETWORK_CONFIG[${analyticsKey}].CONTRACT_ADDRESS.`
    );
  }

  const contractValidation = validateStellarContractAddress(contractIdFromAnalytics);
  if (!contractValidation.valid) {
    throw new Error(`Invalid contract configuration: ${contractValidation.error}`);
  }

  const contract = parseContractId(contractIdFromAnalytics);

  cachedConfig = {
    network,
    contract,
    api: {
      coreApiUrl: walletNet.coreApiUrl,
      explorerUrl: walletNet.explorerUrl,
      rpcUrl: walletNet.rpcUrl,
    },
    soroban: {
      rpcUrl: sorobanNet.rpcUrl,
      explorerUrl: sorobanNet.explorerUrl,
      contractId: sorobanContractId,
    },
  };

  return cachedConfig;
}

/**
 * Useful for unit tests to force re-evaluation after env changes.
 */
export function __resetRuntimeConfigForTests(): void {
  cachedConfig = null;
}

