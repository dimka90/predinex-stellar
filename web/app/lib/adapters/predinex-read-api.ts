/**
 * Read-side adapter: Canonical Soroban read-only calls for the Predinex contract.
 * UI and hooks should import chain reads from here instead of `stacks-api` where practical.
 *
 * This adapter uses the Soroban RPC layer for pool and user bet data,
 * providing the canonical target-chain read path for Stellar.
 */
import { getRuntimeConfig } from '../runtime-config';
import {
  getPoolFromSoroban,
  getUserBetFromSoroban,
  getPoolCountFromSoroban,
  type Pool,
  type UserBetData,
} from '../soroban-read-api';
import {
  getTotalVolume,
  getMarkets,
  getUserActivity,
} from '../stacks-api';
import { getUserActivityFromSoroban } from '../soroban-event-service';
import type { ActivityItem } from './types';

export function getStacksCoreApiBaseUrl(): string {
  return getRuntimeConfig().api.coreApiUrl;
}

/** JSON from Hiro extended API: contract events list. */
export async function fetchPredinexContractEvents(limit: number): Promise<{
  results?: unknown[];
}> {
  const cfg = getRuntimeConfig();
  const url = `${cfg.api.coreApiUrl}/extended/v1/contract/${cfg.contract.address}/${cfg.contract.name}/events?limit=${limit}`;
  const response = await fetch(url);
  return response.json();
}

/**
 * Fetches user activity via the Soroban event pipeline.
 * Falls back to an empty array if the Soroban contract ID is not configured.
 */
async function getUserActivitySoroban(
  address: string,
  limit: number
): Promise<ActivityItem[]> {
  const cfg = getRuntimeConfig();
  const { soroban } = cfg;
  return getUserActivityFromSoroban(address, limit, {
    rpcUrl: soroban.rpcUrl,
    explorerUrl: soroban.explorerUrl,
    contractId: soroban.contractId,
  });
}

/**
 * Get pool data from Soroban (canonical read path).
 * Unwraps the result to return Pool | null for backward compatibility.
 */
async function getPool(poolId: number): Promise<Pool | null> {
  const result = await getPoolFromSoroban(poolId);
  if (result.error) {
    console.error(`[predinexReadApi] Error fetching pool ${poolId}:`, result.error);
  }
  return result.pool;
}

/**
 * Get user bet data from Soroban (canonical read path).
 * Unwraps the result to return UserBetData | null for backward compatibility.
 */
async function getUserBet(poolId: number, userAddress: string): Promise<UserBetData | null> {
  const result = await getUserBetFromSoroban(poolId, userAddress);
  if (result.error) {
    console.error(`[predinexReadApi] Error fetching user bet for pool ${poolId}:`, result.error);
  }
  return result.bet;
}

/**
 * Get total pool count from Soroban (canonical read path).
 */
async function getPoolCount(): Promise<number> {
  return getPoolCountFromSoroban();
}

export const predinexReadApi = {
  /** Canonical Soroban read: get pool by ID */
  getPool,
  /** Canonical Soroban read: get user's bet in a pool */
  getUserBet,
  /** Canonical Soroban read: get total pool count */
  getPoolCount,
  /** @deprecated Use Stacks API for volume data */
  getTotalVolume,
  /** @deprecated Use Stacks API for markets list */
  getMarkets,
  /** @deprecated Use getUserActivitySoroban */
  getUserActivity,
  /** Canonical Soroban read: get user activity via events */
  getUserActivitySoroban,
};
