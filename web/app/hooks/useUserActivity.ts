'use client';

import { useState, useEffect, useCallback } from 'react';
import { predinexReadApi } from '../lib/adapters/predinex-read-api';
import type { ActivityItem } from '../lib/adapters/types';

interface UseUserActivityReturn {
    activities: ActivityItem[];
    isLoading: boolean;
    error: string | null;
    refresh: () => void;
}

/**
 * Hook to fetch and manage a user's on-chain activity feed.
 * Automatically fetches when an address is provided.
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

        setIsLoading(true);
        setError(null);

        try {
            const data = await predinexReadApi.getUserActivity(address, limit);
            setActivities(data);
        } catch (e) {
            setError('Failed to load activity. Please try again.');
            console.error('useUserActivity error:', e);
        } finally {
            setIsLoading(false);
        }
    }, [address, limit]);

    useEffect(() => {
        fetchActivity();
    }, [fetchActivity]);

    return {
        activities,
        isLoading,
        error,
        refresh: fetchActivity,
    };
}
