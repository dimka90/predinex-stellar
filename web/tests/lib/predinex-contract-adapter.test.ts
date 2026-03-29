import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as StacksConnect from '@stacks/connect';
import * as AppKitTx from '../../lib/appkit-transactions';
import { predinexContract } from '../../app/lib/adapters/predinex-contract';

vi.mock('@stacks/connect', () => ({
  openContractCall: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../lib/appkit-transactions', () => ({
  callContract: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../app/lib/runtime-config', () => ({
  getRuntimeConfig: vi.fn(() => ({
    network: 'testnet' as const,
    contract: {
      address: 'ST1TEST',
      name: 'predinex-pool',
      id: 'ST1TEST.predinex-pool',
    },
    api: {
      coreApiUrl: 'https://api.testnet.hiro.so',
      explorerUrl: 'https://explorer.hiro.so',
      rpcUrl: 'https://api.testnet.hiro.so',
    },
  })),
}));

describe('predinexContract adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('placeBet forwards to openContractCall with place-bet and pool args', async () => {
    await predinexContract.placeBet({
      poolId: 3,
      outcome: 1,
      amountMicroStx: 2_000_000,
    });
    expect(StacksConnect.openContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        contractAddress: 'ST1TEST',
        contractName: 'predinex-pool',
        functionName: 'place-bet',
      })
    );
  });

  it('claimWinnings uses callContract with claim-winnings', async () => {
    await predinexContract.claimWinnings({ poolId: 7 });
    expect(AppKitTx.callContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'claim-winnings',
        network: 'testnet',
      })
    );
  });
});
