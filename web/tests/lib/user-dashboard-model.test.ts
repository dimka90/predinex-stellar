import { describe, it, expect } from 'vitest';
import { calculateDashboardStats } from '../../app/lib/user-dashboard/model';
import type { UserBet } from '../../app/lib/user-dashboard/types';

describe('calculateDashboardStats', () => {
  it('aggregates bet list into dashboard stats', () => {
    const bets: UserBet[] = [
      { poolId: 1, poolTitle: 'A', outcome: 'Y', amount: 10, status: 'active', createdAt: 0 },
      { poolId: 2, poolTitle: 'B', outcome: 'N', amount: 20, status: 'won', createdAt: 0, winnings: 30 },
    ];
    const stats = calculateDashboardStats(bets);
    expect(stats.totalBets).toBe(2);
    expect(stats.totalWagered).toBe(30);
    expect(stats.activeBets).toBe(1);
    expect(stats.settledBets).toBe(1);
    expect(stats.totalWinnings).toBe(30);
    expect(stats.winRate).toBe(50);
  });
});
