/**
 * Fixtures for PoolIntegration component
 * Static mock data moved out of render-time component
 */

export interface Pool {
  id: number;
  title: string;
  description: string;
  outcomeA: string;
  outcomeB: string;
  totalA: number;
  totalB: number;
  settled: boolean;
  winningOutcome?: number;
  creator: string;
  createdAt: number;
  expiryBlock: number;
}

export const mockPools: Pool[] = [
  {
    id: 0,
    title: 'Bitcoin Price > $100k?',
    description: 'Will Bitcoin reach $100,000 by end of Q1 2025?',
    outcomeA: 'Yes',
    outcomeB: 'No',
    totalA: 50000000,
    totalB: 30000000,
    settled: false,
    creator: 'SP...',
    createdAt: Date.now(),
    expiryBlock: 144,
  },
];
