'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserBet } from '../dashboard-types';
import { getUserBets } from '../dashboard-api';

interface UseActiveBetsReturn {
  activeBets: UserBet[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetches the current user's active (open) on-chain positions.
 * Returns only bets with status === 'active'.
 */
export function useActiveBets(userAddress: string | null | undefined): UseActiveBetsReturn {
  const [activeBets, setActiveBets] = useState<UserBet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBets = useCallback(async () => {
    if (!userAddress) {
      setActiveBets([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const bets = await getUserBets(userAddress);
      setActiveBets(bets.filter((b) => b.status === 'active'));
    } catch (e) {
      setError('Failed to load active positions. Please try again.');
      console.error('useActiveBets error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  return { activeBets, isLoading, error, refresh: fetchBets };
}
