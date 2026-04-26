import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearMarketListCache,
  readMarketListCache,
  writeMarketListCache,
  MARKET_LIST_CACHE_KEY,
  MARKET_LIST_CACHE_TTL_MS,
  MARKET_LIST_CACHE_VERSION
} from '../../app/lib/market-list-cache';
import type { ProcessedMarket } from '../../app/lib/market-types';

const sampleMarket: ProcessedMarket = {
  poolId: 1,
  title: 'Sample Market',
  description: 'A market used for cache tests.',
  outcomeA: 'A',
  outcomeB: 'B',
  totalVolume: 123,
  oddsA: 60,
  oddsB: 40,
  status: 'active',
  timeRemaining: 10,
  createdAt: 1700000000,
  settledAt: null,
  creator: 'ST123'
};

describe('market-list-cache', () => {
  beforeEach(() => {
    clearMarketListCache();
    localStorage.clear();
  });

  it('returns fresh cache when within TTL', () => {
    const now = 1_700_000_000_000;
    writeMarketListCache([sampleMarket], now);

    const res = readMarketListCache(now + 1_000);
    expect(res.isFresh).toBe(true);
    expect(res.markets).toEqual([sampleMarket]);
  });

  it('invalidates stale cache after TTL and removes it', () => {
    const now = 1_700_000_000_000;
    writeMarketListCache([sampleMarket], now);

    const res = readMarketListCache(now + MARKET_LIST_CACHE_TTL_MS + 1);
    expect(res.isFresh).toBe(false);
    expect(res.markets).toEqual([]);
    expect(localStorage.getItem(MARKET_LIST_CACHE_KEY)).toBeNull();
  });

  it('invalidates cache on version mismatch and removes it', () => {
    const now = 1_700_000_000_000;

    localStorage.setItem(
      MARKET_LIST_CACHE_KEY,
      JSON.stringify({
        version: MARKET_LIST_CACHE_VERSION + 999,
        cachedAt: now,
        markets: [sampleMarket]
      })
    );

    const res = readMarketListCache(now);
    expect(res.isFresh).toBe(false);
    expect(res.markets).toEqual([]);
    expect(localStorage.getItem(MARKET_LIST_CACHE_KEY)).toBeNull();
  });
});

