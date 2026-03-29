// Enhanced types for Market Discovery System

export interface PoolData {
  poolId: number;
  creator: string;
  title: string;
  description: string;
  outcomeAName: string;
  outcomeBName: string;
  totalA: bigint;
  totalB: bigint;
  settled: boolean;
  winningOutcome: number | null;
  createdAt: number;
  settledAt: number | null;
  expiry: number;
}

export interface ProcessedMarket {
  poolId: number;
  title: string;
  description: string;
  outcomeA: string;
  outcomeB: string;
  totalVolume: number;
  oddsA: number;
  oddsB: number;
  status: 'active' | 'settled' | 'expired';
  timeRemaining: number | null;
  createdAt: number;
  settledAt: number | null;
  creator: string;
}

export interface MarketFilters {
  search: string;
  status: 'all' | 'active' | 'settled' | 'expired';
  sortBy: 'volume' | 'newest' | 'ending-soon';
}

export interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}

export type MarketStatus = 'active' | 'settled' | 'expired';
export type SortOption = 'volume' | 'newest' | 'ending-soon';
export type StatusFilter = 'all' | 'active' | 'settled' | 'expired';