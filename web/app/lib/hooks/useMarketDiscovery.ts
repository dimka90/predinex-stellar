'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { ProcessedMarket, MarketFilters, PaginationState } from '../market-types';
import { readBlockHeightWarning, readMarketListCache, warmMarketListCache } from '../market-list-cache';
import {
  classifyConnectivityIssue,
  getConnectivityMessage,
  withTimeout,
} from '../network-errors';
import { useVisibilityAwarePolling } from './useVisibilityAwarePolling';

interface UseMarketDiscoveryState {
  // Data
  allMarkets: ProcessedMarket[];
  filteredMarkets: ProcessedMarket[];
  paginatedMarkets: ProcessedMarket[];
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Non-blocking data freshness warnings
  blockHeightWarning: string | null;

  // Filters and pagination
  filters: MarketFilters;
  pagination: PaginationState;
  
  // Actions
  setSearch: (search: string) => void;
  setStatusFilter: (status: MarketFilters['status']) => void;
  setSortBy: (sortBy: MarketFilters['sortBy']) => void;
  setPage: (page: number) => void;
  retry: () => void;
}

const ITEMS_PER_PAGE = 12;
const REFRESH_INTERVAL_MS = 60_000;

/**
 * useMarketDiscovery
 *
 * Central hook for the markets discovery page. Handles:
 * - Instant first paint via localStorage cache
 * - Background refresh with error recovery
 * - Filtering, sorting and pagination with minimal re-renders
 *
 * ## Performance notes
 * - All derived state (`filteredMarkets`, `paginatedMarkets`, `pagination`) is
 *   computed with `useMemo` keyed on the narrowest possible dependency set.
 * - Filter setter callbacks depend only on `setFilters`/`setCurrentPage` (both
 *   stable), so they never cause child re-renders due to referential inequality.
 * - Page reset on filter change is batched inside the setter functions rather
 *   than via an additional `useEffect`, avoiding a superfluous render cycle.
 * - `setPage` reads the current filtered count via a ref so its reference
 *   stays stable even as the list length changes.
 */
export function useMarketDiscovery(): UseMarketDiscoveryState {
  // Instant first paint from cached market list.
  const [cacheSnapshot] = useState(() => readMarketListCache());
  const hasFreshInitialCacheRef = useRef(cacheSnapshot.isFresh);
  const hasAnyMarketsRef = useRef(cacheSnapshot.markets.length > 0);

  const [blockHeightWarning, setBlockHeightWarning] = useState<string | null>(() =>
    readBlockHeightWarning()
  );

  // Core data state
  const [allMarkets, setAllMarkets] = useState<ProcessedMarket[]>(cacheSnapshot.markets);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cacheSnapshot.isFresh);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state – flattened so useMemo deps can be individual scalars
  const [search, setSearchState] = useState('');
  const [status, setStatusState] = useState<MarketFilters['status']>('all');
  const [sortBy, setSortByState] = useState<MarketFilters['sortBy']>('newest');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Keep a ref to the current filtered count so `setPage` stays stable
  const filteredCountRef = useRef(0);

  // Fetch markets data
  const fetchMarkets = useCallback(async (options?: { forceLoading?: boolean }) => {
    const shouldShowLoading =
      options?.forceLoading || !hasFreshInitialCacheRef.current;

    try {
      if (shouldShowLoading) setIsLoading(true);
      setError(null);
      
      const processedMarkets = await withTimeout(
        warmMarketListCache(),
        12000,
        'Market loading timeout'
      );
      
      setAllMarkets(processedMarkets);
      hasAnyMarketsRef.current = processedMarkets.length > 0;
      setBlockHeightWarning(readBlockHeightWarning());
    } catch (err) {
      console.error('Failed to fetch markets:', err);
      const issue = classifyConnectivityIssue(err);
      const message = getConnectivityMessage(issue, 'Loading markets');

      // Preserve cached markets (if any) on background refresh failures.
      if (hasAnyMarketsRef.current) {
        setError(null);
        setBlockHeightWarning(message);
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
      hasFreshInitialCacheRef.current = true;
    }
  }, []);

  useVisibilityAwarePolling(fetchMarkets, REFRESH_INTERVAL_MS);

  // Filter and sort markets
  // Deps are individual scalars — prevents spurious recalculation from a new
  // `filters` object reference that carries the same values.
  const filteredMarkets = useMemo(() => {
    let filtered = allMarkets;

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(market =>
        market.title.toLowerCase().includes(searchLower) ||
        market.description.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (status !== 'all') {
      filtered = filtered.filter(market => market.status === status);
    }

    // Apply sorting — always create a new array so we don't mutate state
    const sorted = [...filtered];
    switch (sortBy) {
      case 'volume':
        sorted.sort((a, b) => b.totalVolume - a.totalVolume);
        break;
      case 'newest':
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'ending-soon':
        sorted.sort((a, b) => {
          if (a.status === 'active' && b.status !== 'active') return -1;
          if (b.status === 'active' && a.status !== 'active') return 1;
          if (a.status === 'active' && b.status === 'active') {
            const aTime = a.timeRemaining ?? Infinity;
            const bTime = b.timeRemaining ?? Infinity;
            return aTime - bTime;
          }
          return b.createdAt - a.createdAt;
        });
        break;
    }

    return sorted;
  }, [allMarkets, search, status, sortBy]);

  // Keep the ref in sync with the latest filtered count (no extra render)
  filteredCountRef.current = filteredMarkets.length;

  // Calculate pagination
  const pagination = useMemo((): PaginationState => {
    const totalItems = filteredMarkets.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    return {
      currentPage,
      itemsPerPage: ITEMS_PER_PAGE,
      totalItems,
      totalPages,
    };
  }, [filteredMarkets.length, currentPage]);

  // Get paginated markets
  const paginatedMarkets = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredMarkets.slice(startIndex, endIndex);
  }, [filteredMarkets, currentPage]);

  // Stable filter/sort actions — reset page inline to avoid an extra render
  // cycle caused by a separate useEffect watching filter values.
  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setCurrentPage(1);
  }, []);

  const setStatusFilter = useCallback((value: MarketFilters['status']) => {
    setStatusState(value);
    setCurrentPage(1);
  }, []);

  const setSortBy = useCallback((value: MarketFilters['sortBy']) => {
    setSortByState(value);
    setCurrentPage(1);
  }, []);

  // `setPage` reads filteredCountRef so its reference never changes
  const setPage = useCallback((page: number) => {
    const totalPages = Math.ceil(filteredCountRef.current / ITEMS_PER_PAGE);
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, []);

  const retry = useCallback(() => {
    fetchMarkets({ forceLoading: true });
  }, [fetchMarkets]);

  // Compose the filters object once so callers get a stable shape
  const filters = useMemo<MarketFilters>(
    () => ({ search, status, sortBy }),
    [search, status, sortBy]
  );

  return {
    // Data
    allMarkets,
    filteredMarkets,
    paginatedMarkets,
    
    // Loading states
    isLoading,
    error,
    blockHeightWarning,
    
    // Filters and pagination
    filters,
    pagination,
    
    // Actions
    setSearch,
    setStatusFilter,
    setSortBy,
    setPage,
    retry,
  };
}
