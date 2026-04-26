'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAllPools } from '../enhanced-stacks-api';
import { getUserBets } from '../dashboard-api';

export interface LeaderboardEntry {
  address: string;
  /** Total STX wagered across all pools this address participated in */
  totalWagered: number;
  /** Number of pools the address has bet in */
  poolsParticipated: number;
  /** Composite score used for ranking: totalWagered (μSTX) */
  score: number;
  rank: number;
}

interface UseLeaderboardReturn {
  entries: LeaderboardEntry[];
  userRank: number | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Builds a leaderboard from real on-chain data.
 *
 * Ranking formula (score):
 *   score = totalWagered (in μSTX)
 *
 * Data source: all pools fetched via get-pool-count / get-pool contract
 * read-only calls. Each pool exposes its creator; we aggregate volume
 * per creator address as a proxy for platform contribution.
 *
 * Limitation: the contract's get-user-bet read-only function requires
 * (pool-id, address) — scanning every (pool × address) pair on-chain is
 * not feasible client-side, so we use pool creators + their pool volumes
 * as the ranking signal. This is the richest signal available without an
 * indexer.
 */
export function useLeaderboard(currentUserAddress?: string | null): UseLeaderboardReturn {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const pools = await fetchAllPools();

      // Aggregate volume per creator address
      const volumeMap = new Map<string, { totalWagered: number; pools: Set<number> }>();

      for (const pool of pools) {
        const addr = pool.creator;
        if (!addr) continue;
        const poolVolume = Number(pool.totalA + pool.totalB);
        const existing = volumeMap.get(addr) ?? { totalWagered: 0, pools: new Set() };
        existing.totalWagered += poolVolume;
        existing.pools.add(pool.poolId);
        volumeMap.set(addr, existing);
      }

      // Also include the current user even if they haven't created pools
      if (currentUserAddress && !volumeMap.has(currentUserAddress)) {
        try {
          const userBets = await getUserBets(currentUserAddress);
          const wagered = userBets.reduce((s, b) => s + b.amountBet, 0);
          if (wagered > 0) {
            volumeMap.set(currentUserAddress, {
              totalWagered: wagered,
              pools: new Set(userBets.map((b) => b.poolId)),
            });
          }
        } catch {
          // non-fatal — user simply won't appear if fetch fails
        }
      }

      // Sort descending by score and assign ranks
      const sorted: LeaderboardEntry[] = Array.from(volumeMap.entries())
        .map(([address, data]) => ({
          address,
          totalWagered: data.totalWagered,
          poolsParticipated: data.pools.size,
          score: data.totalWagered,
          rank: 0,
        }))
        .sort((a, b) => b.score - a.score)
        .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

      setEntries(sorted);

      if (currentUserAddress) {
        const found = sorted.find((e) => e.address === currentUserAddress);
        setUserRank(found?.rank ?? null);
      }
    } catch (e) {
      console.error('useLeaderboard error:', e);
      setError('Failed to load leaderboard. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUserAddress]);

  useEffect(() => {
    buildLeaderboard();
  }, [buildLeaderboard]);

  return { entries, userRank, isLoading, error, refresh: buildLeaderboard };
}
