/**
 * Read-side adapter: Hiro / Stacks read-only calls and indexer-shaped HTTP helpers.
 * UI and hooks should import chain reads from here instead of `stacks-api` where practical.
 */
import { getRuntimeConfig } from '../runtime-config';
import {
  getPool,
  getUserBet,
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

export const predinexReadApi = {
  getPool,
  getUserBet,
  getTotalVolume,
  getMarkets,
  /** @deprecated Use getUserActivitySoroban — kept for backwards compat */
  getUserActivity,
  getUserActivitySoroban,
};
