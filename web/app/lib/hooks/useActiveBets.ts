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
 * Fetches the current user's positions used by the dashboard "Active Bets"
 * card, including settled claimable winners.
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
      setActiveBets(bets);
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
