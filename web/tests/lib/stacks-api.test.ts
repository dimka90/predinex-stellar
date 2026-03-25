import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCallReadOnlyFunction, cvToValue } from '@stacks/transactions';
import { getPoolCount, getPool, fetchActivePools, getUserBet } from '../../app/lib/stacks-api';
import { uintCV } from '@stacks/transactions';

// Mock runtime-config so tests don't require NEXT_PUBLIC_NETWORK env var
vi.mock('../../app/lib/runtime-config', () => ({
  getRuntimeConfig: vi.fn(() => ({
    network: 'testnet',
    contract: {
      address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      name: 'predinex-pool',
      id: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.predinex-pool',
    },
    api: {
      coreApiUrl: 'https://api.testnet.hiro.so',
      explorerUrl: 'https://explorer.hiro.so?chain=testnet',
      rpcUrl: 'https://api.testnet.hiro.so',
    },
  })),
  __resetRuntimeConfigForTests: vi.fn(),
}));

// Mock @stacks/transactions
vi.mock('@stacks/transactions', async () => {
  const actual = await vi.importActual('@stacks/transactions');
  return {
    ...actual,
    fetchCallReadOnlyFunction: vi.fn(),
    cvToValue: vi.fn(),
  };
});

describe('stacks-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPoolCount', () => {
    it('returns pool count successfully', async () => {
      vi.mocked(fetchCallReadOnlyFunction).mockResolvedValue({
        type: 0, // ResponseOk
        value: { type: 1, value: 5n }, // uint
      } as any);
      vi.mocked(cvToValue).mockReturnValue(5);

      const count = await getPoolCount();
      expect(count).toBe(5);
      expect(fetchCallReadOnlyFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'get-pool-count',
        })
      );
    });

    it('returns 0 on error', async () => {
      vi.mocked(fetchCallReadOnlyFunction).mockRejectedValue(new Error('Network error'));

      const count = await getPoolCount();
      expect(count).toBe(0);
    });
  });

  describe('getPool', () => {
    it('returns pool data successfully', async () => {
      const mockPoolData = {
        'pool-id': { type: 1, value: 0n },
        creator: { type: 5, value: 'ST123' },
        title: { type: 2, value: 'Test Pool' },
        description: { type: 2, value: 'Test Description' },
        'outcome-a-name': { type: 2, value: 'Outcome A' },
        'outcome-b-name': { type: 2, value: 'Outcome B' },
        'total-a': { type: 1, value: 1000000n },
        'total-b': { type: 1, value: 2000000n },
        settled: { type: 3, value: false },
        'winning-outcome': { type: 0, value: null },
        expiry: { type: 1, value: 1000n },
      };

      vi.mocked(fetchCallReadOnlyFunction).mockResolvedValue({
        type: 0, // ResponseOk
        value: { type: 4, value: mockPoolData }, // OptionalSome
      } as any);
      // cvToValue with readable=true returns plain object
      vi.mocked(cvToValue).mockReturnValue({
        title: 'Test Pool',
        description: 'Test Description',
        creator: 'ST123',
        'outcome-a-name': 'Outcome A',
        'outcome-b-name': 'Outcome B',
        'total-a': 1000000n,
        'total-b': 2000000n,
        settled: false,
        'winning-outcome': null,
        expiry: 1000n,
      });

      const pool = await getPool(0);
      expect(pool).toBeTruthy();
      expect(pool?.id).toBe(0);
      expect(pool?.title).toBe('Test Pool');
      expect(fetchCallReadOnlyFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'get-pool',
          functionArgs: [uintCV(0)],
        })
      );
    });

    it('returns null when pool does not exist', async () => {
      vi.mocked(fetchCallReadOnlyFunction).mockResolvedValue({
        type: 0, // ResponseOk
        value: { type: 5, value: null }, // OptionalNone
      } as any);
      vi.mocked(cvToValue).mockReturnValue(null);

      const pool = await getPool(999);
      expect(pool).toBeNull();
    });

    it('returns null on error', async () => {
      vi.mocked(fetchCallReadOnlyFunction).mockRejectedValue(new Error('Network error'));

      const pool = await getPool(0);
      expect(pool).toBeNull();
    });
  });

  describe('fetchActivePools', () => {
    it('fetches all active pools successfully', async () => {
      vi.mocked(fetchCallReadOnlyFunction).mockResolvedValueOnce({
        type: 0,
        value: { type: 1, value: 3n }, // pool count = 3
      } as any);
      vi.mocked(cvToValue).mockReturnValueOnce(3);

      // Mock getPool calls - cvToValue(result, true) returns plain readable values
      const mockPoolData = {
        title: 'Pool 0',
        description: 'Desc',
        creator: 'ST123',
        'outcome-a-name': 'A',
        'outcome-b-name': 'B',
        'total-a': 1000000n,
        'total-b': 2000000n,
        settled: false,
        'winning-outcome': null,
        expiry: 1000n,
      };

      vi.mocked(fetchCallReadOnlyFunction).mockResolvedValue({
        type: 0,
        value: { type: 4, value: mockPoolData },
      } as any);
      vi.mocked(cvToValue).mockReturnValue(mockPoolData);

      const pools = await fetchActivePools();
      expect(pools).toHaveLength(3);
      expect(fetchCallReadOnlyFunction).toHaveBeenCalledTimes(4); // 1 for count + 3 for pools
    });

    it('handles errors gracefully', async () => {
      vi.mocked(fetchCallReadOnlyFunction).mockRejectedValue(new Error('Network error'));

      const pools = await fetchActivePools();
      expect(pools).toEqual([]);
    });
  });

  describe('getUserBet', () => {
    it('returns user bet data successfully', async () => {
      const mockBetData = {
        'amount-a': { type: 1, value: 1000000n },
        'amount-b': { type: 1, value: 500000n },
        'total-bet': { type: 1, value: 1500000n },
      };

      // Use a valid Stacks address format
      const validAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';

      vi.mocked(fetchCallReadOnlyFunction).mockResolvedValue({
        type: 0,
        value: { type: 4, value: mockBetData },
      } as any);
      vi.mocked(cvToValue).mockReturnValue({
        'amount-a': 1000000,
        'amount-b': 500000,
        'total-bet': 1500000,
      });

      const bet = await getUserBet(0, validAddress);
      expect(bet).toBeTruthy();
      expect(bet?.amountA).toBe(1000000);
      expect(bet?.amountB).toBe(500000);
      expect(bet?.totalBet).toBe(1500000);
    });

    it('returns null when user has no bet', async () => {
      const validAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
      vi.mocked(fetchCallReadOnlyFunction).mockResolvedValue({
        type: 0,
        value: { type: 5, value: null }, // OptionalNone
      } as any);
      vi.mocked(cvToValue).mockReturnValue(null);

      const bet = await getUserBet(0, validAddress);
      expect(bet).toBeNull();
    });

    it('returns null on error', async () => {
      const validAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
      vi.mocked(fetchCallReadOnlyFunction).mockRejectedValue(new Error('Network error'));

      const bet = await getUserBet(0, validAddress);
      expect(bet).toBeNull();
    });
  });
});

