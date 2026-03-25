import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCallReadOnlyFunction, cvToValue } from '@stacks/transactions';
import { getPoolCount } from '../../app/lib/enhanced-stacks-api';
import { __resetRuntimeConfigForTests } from '../../app/lib/runtime-config';

vi.mock('@stacks/transactions', async () => {
  const actual = await vi.importActual('@stacks/transactions');
  return {
    ...actual,
    fetchCallReadOnlyFunction: vi.fn(),
    cvToValue: vi.fn(),
  };
});

describe('market discovery network selection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    __resetRuntimeConfigForTests();
    process.env = { ...originalEnv };
    vi.mocked(fetchCallReadOnlyFunction).mockResolvedValue({} as any);
    vi.mocked(cvToValue).mockReturnValue(0);
  });

  it('targets testnet when NEXT_PUBLIC_NETWORK=testnet', async () => {
    process.env.NEXT_PUBLIC_NETWORK = 'testnet';

    await getPoolCount();

    expect(fetchCallReadOnlyFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        network: expect.objectContaining({
          client: expect.objectContaining({
            baseUrl: expect.stringContaining('testnet'),
          }),
        }),
      })
    );
  });

  it('targets mainnet when NEXT_PUBLIC_NETWORK=mainnet', async () => {
    process.env.NEXT_PUBLIC_NETWORK = 'mainnet';

    await getPoolCount();

    expect(fetchCallReadOnlyFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        network: expect.objectContaining({
          client: expect.objectContaining({
            baseUrl: expect.stringContaining('mainnet'),
          }),
        }),
      })
    );
  });
});

