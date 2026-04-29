'use client';

import { useState, useCallback } from 'react';
import { predinexReadApi } from '../lib/adapters/predinex-read-api';
import type { ActivityItem } from '../lib/adapters/types';
import { userActivityCache } from '../lib/cache-invalidation';
import { useVisibilityAwarePolling } from '../lib/hooks/useVisibilityAwarePolling';

const REFRESH_INTERVAL_MS = 30_000;

interface UseUserActivityReturn {
    activities: ActivityItem[];
    isLoading: boolean;
    error: string | null;
    refresh: () => void;
}

/**
 * Hook to fetch and manage a user's on-chain activity feed.
 * Uses the Soroban event service to ingest contract events from Stellar.
 * Automatically fetches when an address is provided.
 * Uses the shared userActivityCache so mutation-driven invalidation
 * (via invalidateOnPlaceBet / invalidateOnClaimWinnings) forces a fresh fetch.
 */
export function useUserActivity(
    address: string | undefined,
    limit: number = 20
): UseUserActivityReturn {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchActivity = useCallback(async () => {
        if (!address) {
            setActivities([]);
            return;
        }

        // Return in-memory cached result if still fresh
        const cached = userActivityCache.get<ActivityItem[]>(address);
        if (cached) {
            setActivities(cached);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const data = await predinexReadApi.getUserActivitySoroban(address, limit);
            setActivities(data);
            userActivityCache.set(address, data, REFRESH_INTERVAL_MS);
        } catch (e) {
            setError('Failed to load activity. Please try again.');
            console.error('useUserActivity error:', e);
        } finally {
            setIsLoading(false);
        }
    }, [address, limit]);

    useVisibilityAwarePolling(fetchActivity, REFRESH_INTERVAL_MS, {
        enabled: !!address,
    });

    return {
        activities,
        isLoading,
        error,
        refresh: fetchActivity,
    };
}
