'use client';

import { useState, useEffect, useCallback } from 'react';

export interface LeaderboardEntry {
  address: string;
  /** Total predictions made by this address */
  totalPredictions: number;
  /** Win percentage (0-100) */
  winPercentage: number;
  /** Total net profits in μSTX (winnings - wagered) */
  totalProfits: number;
  /** Current winning streak (consecutive pools won) */
  currentStreak: number;
  /** Composite score used for ranking: totalProfits (μSTX) */
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
 * Builds a leaderboard from mock data.
 *
 * Ranking formula (score):
 *   score = totalProfits (in μSTX)
 *
 * Metrics:
 *   - totalPredictions: Total bets placed
 *   - winPercentage: Win rate as percentage (0-100)
 *   - totalProfits: Net winnings - total wagered
 *   - currentStreak: Consecutive pools won
 */
export function useLeaderboard(currentUserAddress?: string | null): UseLeaderboardReturn {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock leaderboard data with the new metrics
  const mockLeaderboardData: LeaderboardEntry[] = [
    { address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE2VGZJSHRTB3J2J', totalPredictions: 47, winPercentage: 68.1, totalProfits: 12500000, currentStreak: 8, score: 0, rank: 0 },
    { address: 'ST2CY5V39TQDPWCZ6W5K6N2ZJH2G5W8TR3T6V3N1M5', totalPredictions: 32, winPercentage: 71.9, totalProfits: 9800000, currentStreak: 5, score: 0, rank: 0 },
    { address: 'ST3AM1M5V4N6Z8K9P0R2S4T6V8W0X2Y4Z6A8B0C2D4', totalPredictions: 28, winPercentage: 64.3, totalProfits: 7200000, currentStreak: 3, score: 0, rank: 0 },
    { address: 'ST4BQ9V8W0X2Y4Z6A8B0C2D4E6F8G0H2I4J6K8L0M2', totalPredictions: 55, winPercentage: 58.2, totalProfits: 6500000, currentStreak: 2, score: 0, rank: 0 },
    { address: 'ST5CR7E9V1X3Y5Z7A9B1C3D5E7F9G1H3I5J7K9L1M3', totalPredictions: 19, winPercentage: 78.9, totalProfits: 6100000, currentStreak: 6, score: 0, rank: 0 },
    { address: 'ST6DS8F0W2X4Y6Z8A0B2C4D6E8F0G2H4I6J8K0L2M4', totalPredictions: 41, winPercentage: 61.0, totalProfits: 5800000, currentStreak: 4, score: 0, rank: 0 },
    { address: 'ST7ET9G1X3Y5Z7A9B1C3D5E7F9G1H3I5J7K9L1M3', totalPredictions: 23, winPercentage: 69.6, totalProfits: 4500000, currentStreak: 1, score: 0, rank: 0 },
    { address: 'ST8FU0H2X4Y6Z8A0B2C4D6E8F0G2H4I6J8K0L2M4', totalPredictions: 36, winPercentage: 55.6, totalProfits: 3200000, currentStreak: 0, score: 0, rank: 0 },
    { address: 'ST9GV1I3X5Y7Z9A1B3C5D7E9F1G3H5I7J9K1L3M5', totalPredictions: 15, winPercentage: 73.3, totalProfits: 2800000, currentStreak: 3, score: 0, rank: 0 },
    { address: 'ST0HW2J4X6Y8Z0A2B4C6D8E0F2G4H6I8J0K2L4M6', totalPredictions: 29, winPercentage: 51.7, totalProfits: 1500000, currentStreak: 0, score: 0, rank: 0 },
  ];

  const buildLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Add current user to leaderboard if specified
      let entriesWithUser = [...mockLeaderboardData];
      
      if (currentUserAddress) {
        // Check if user already exists in mock data
        const existingUser = entriesWithUser.find(e => e.address === currentUserAddress);
        
        if (!existingUser) {
          // Add mock entry for current user
          const userEntry: LeaderboardEntry = {
            address: currentUserAddress,
            totalPredictions: 12,
            winPercentage: 58.3,
            totalProfits: 850000,
            currentStreak: 2,
            score: 0,
            rank: 0,
          };
          entriesWithUser.push(userEntry);
        }
      }

      // Sort by totalProfits (descending) and assign ranks
      const sorted = entriesWithUser
        .map(entry => ({ ...entry, score: entry.totalProfits }))
        .sort((a, b) => b.score - a.score)
        .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

      setEntries(sorted);

      if (currentUserAddress) {
        const found = sorted.find(e => e.address === currentUserAddress);
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
