'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardData, DashboardFilters, ClaimTransaction } from '../dashboard-types';
import { fetchDashboardData, claimWinnings } from '../dashboard-api';
import { invalidateOnClaimWinnings } from '../cache-invalidation';

interface UseDashboardDataState {
  // Data
  data: DashboardData | null;
  
  // Loading and connection states
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  
  // Filters
  filters: DashboardFilters;
  
  // Claim functionality
  claimTransactions: Map<number, ClaimTransaction>;
  
  // Actions
  refreshData: () => Promise<void>;
  setFilters: (filters: Partial<DashboardFilters>) => void;
  executeClaim: (poolId: number) => Promise<void>;
  retry: () => void;
}

const DEFAULT_FILTERS: DashboardFilters = {
  historyDateRange: {
    start: null,
    end: null
  },
  historyOutcome: 'all',
  historyMarketStatus: 'all',
  sortBy: 'date',
  sortOrder: 'desc'
};

const UPDATE_INTERVAL = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000; // 2 seconds

export function useDashboardData(userAddress: string | null): UseDashboardDataState {
  // Core state
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [claimTransactions, setClaimTransactions] = useState<Map<number, ClaimTransaction>>(new Map());
  
  // Refs for managing intervals and retry logic
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);

  // Fetch dashboard data
  const fetchData = useCallback(async (showLoading: boolean = true) => {
    if (!userAddress) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);
      
      const dashboardData = await fetchDashboardData(userAddress);
      
      if (isMountedRef.current) {
        setData(dashboardData);
        setIsConnected(true);
        retryCountRef.current = 0;
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        setIsConnected(false);
        
        // Implement retry logic
        if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
          retryCountRef.current++;
          retryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              fetchData(false);
            }
          }, RETRY_DELAY * retryCountRef.current);
        }
      }
    } finally {
      if (isMountedRef.current && showLoading) {
        setIsLoading(false);
      }
    }
  }, [userAddress]);

  // Manual refresh function
  const refreshData = useCallback(async () => {
    retryCountRef.current = 0;
    await fetchData(true);
  }, [fetchData]);

  // Set up automatic updates
  useEffect(() => {
    if (!userAddress) return;

    // Initial fetch
    fetchData(true);

    // Set up interval for automatic updates
    updateIntervalRef.current = setInterval(() => {
      if (isMountedRef.current && isConnected) {
        fetchData(false); // Background update without loading state
      }
    }, UPDATE_INTERVAL);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [userAddress, fetchData, isConnected]);

  // Handle component unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update filters
  const setFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Execute claim transaction
  const executeClaim = useCallback(async (poolId: number) => {
    if (!userAddress) return;

    // Set claim as pending
    setClaimTransactions(prev => new Map(prev).set(poolId, {
      poolId,
      amount: 0, // Will be updated after successful claim
      status: 'pending'
    }));

    try {
      const result = await claimWinnings(poolId);
      
      if (result.success) {
        // Invalidate all caches affected by this claim
        if (userAddress) {
          invalidateOnClaimWinnings({ poolId, userAddress });
        }

        // Update claim status to success
        setClaimTransactions(prev => new Map(prev).set(poolId, {
          poolId,
          amount: 0, // Would get actual amount from result
          status: 'success',
          txId: result.txId
        }));
        
        // Refresh dashboard data to reflect the claim
        await refreshData();
      } else {
        // Update claim status to failed
        setClaimTransactions(prev => new Map(prev).set(poolId, {
          poolId,
          amount: 0,
          status: 'failed',
          error: result.error
        }));
      }
    } catch (err) {
      console.error('Failed to execute claim:', err);
      
      // Update claim status to failed
      setClaimTransactions(prev => new Map(prev).set(poolId, {
        poolId,
        amount: 0,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error'
      }));
    }
  }, [userAddress, refreshData]);

  // Retry function for manual retry
  const retry = useCallback(() => {
    retryCountRef.current = 0;
    setError(null);
    fetchData(true);
  }, [fetchData]);

  // Handle user address changes
  useEffect(() => {
    if (userAddress) {
      setData(null);
      setError(null);
      setClaimTransactions(new Map());
      retryCountRef.current = 0;
    }
  }, [userAddress]);

  return {
    data,
    isLoading,
    isConnected,
    error,
    filters,
    claimTransactions,
    refreshData,
    setFilters,
    executeClaim,
    retry
  };
}