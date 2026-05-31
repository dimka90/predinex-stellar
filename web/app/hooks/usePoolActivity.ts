'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PoolActivityEvent } from '../lib/pool-activity';

interface UsePoolActivityReturn {
  events: PoolActivityEvent[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => Promise<void>;
}

const INITIAL_LOAD_SIZE = 100;
const MAX_EVENTS = 100;
const CACHE_TTL = 30000; // 30 seconds

// Simple in-memory cache for pool activity
const poolActivityCache = new Map<number, { events: PoolActivityEvent[]; timestamp: number }>();

/**
 * Hook to fetch and manage pool activity events with infinite scroll support.
 * 
 * Features:
 * - Fetches up to 100 events (INITIAL_LOAD_SIZE)
 * - Simple in-memory cache with 30-second TTL
 * - Request deduplication
 * - Error handling and retry support
 * 
 * @param poolId Pool ID to fetch events for
 * @returns Pool activity state and control methods
 */
export function usePoolActivity(poolId: number | undefined): UsePoolActivityReturn {
  const [events, setEvents] = useState<PoolActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const requestIdRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  // Mock function to fetch pool activity - replace with actual API call
  const fetchPoolActivity = useCallback(
    async (id: number, limit: number): Promise<PoolActivityEvent[]> => {
      // Check cache
      const cached = poolActivityCache.get(id);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.events;
      }

      // TODO: Replace with actual API call to predinexReadApi
      // For now, return empty array to avoid errors
      const mockEvents: PoolActivityEvent[] = [];

      // Cache the result
      poolActivityCache.set(id, { events: mockEvents, timestamp: Date.now() });

      return mockEvents;
    },
    []
  );

  const loadEvents = useCallback(async () => {
    if (!poolId || poolId <= 0) {
      setEvents([]);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const fetchedEvents = await fetchPoolActivity(poolId, INITIAL_LOAD_SIZE);

      // Ignore stale responses
      if (requestId !== requestIdRef.current || !isMountedRef.current) {
        return;
      }

      setEvents(fetchedEvents);
      setHasMore(fetchedEvents.length >= INITIAL_LOAD_SIZE);
    } catch (err) {
      if (!isMountedRef.current) return;

      const message = err instanceof Error ? err.message : 'Failed to load pool activity';
      setError(message);
      console.error(`Failed to load activity for pool ${poolId}:`, err);
      setEvents([]);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [poolId, fetchPoolActivity]);

  useEffect(() => {
    loadEvents();
  }, [poolId, loadEvents]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    // Clear cache for this pool
    if (poolId) {
      poolActivityCache.delete(poolId);
    }
    await loadEvents();
  }, [poolId, loadEvents]);

  const loadMore = useCallback(() => {
    // For now, this is a placeholder for infinite scroll functionality
    // In a full implementation, this would fetch the next page of events
    setHasMore(false);
  }, []);

  return {
    events,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
