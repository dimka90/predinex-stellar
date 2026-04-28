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

  // ============================================================================
  // Issue #231: create-market integration coverage
  //
  // Tests cover wallet rejection, contract failure, and success paths
  // for the create-market feature.
  // ============================================================================

  describe('createMarket', () => {
    const validMarketParams = {
      title: 'Will BTC hit 100k?',
      description: 'Prediction market for Bitcoin price',
      outcomeA: 'Yes',
      outcomeB: 'No',
      durationSeconds: 86400,
    };

    it('J1: createMarket calls openContractCall with create-pool function', async () => {
      await predinexContract.createMarket(validMarketParams);

      expect(StacksConnect.openContractCall).toHaveBeenCalledWith(
        expect.objectContaining({
          contractAddress: 'ST1TEST',
          contractName: 'predinex-pool',
          functionName: 'create-pool',
        })
      );
    });

    it('J2: createMarket passes correct function arguments', async () => {
      await predinexContract.createMarket(validMarketParams);

      const mockCall = vi.mocked(StacksConnect.openContractCall);
      const callArgs = mockCall.mock.calls[0][0] as { functionArgs: unknown[] };
      expect(callArgs.functionArgs).toHaveLength(5);
      expect(callArgs.functionName).toBe('create-pool');
    });

    it('J3: onCancel callback is passed to wallet prompt', async () => {
      const onCancel = vi.fn();
      await predinexContract.createMarket({
        ...validMarketParams,
        onCancel,
      });

      const mockCall = vi.mocked(StacksConnect.openContractCall);
      mockCall.mock.calls[0][0];
      const callArgs = mockCall.mock.calls[0][0] as { onCancel?: () => void };
      expect(callArgs.onCancel).toBe(onCancel);
    });

    it('J4: onFinish callback is passed to wallet prompt', async () => {
      const onFinish = vi.fn();
      await predinexContract.createMarket({
        ...validMarketParams,
        onFinish,
      });

      const mockCall = vi.mocked(StacksConnect.openContractCall);
      const callArgs = mockCall.mock.calls[0][0] as { onFinish?: () => void };
      expect(callArgs.onFinish).toBe(onFinish);
    });

    it('J5: rejects when wallet signature is rejected by user', async () => {
      vi.mocked(StacksConnect.openContractCall).mockRejectedValueOnce(
        new Error('User cancelled')
      );

      await expect(
        predinexContract.createMarket(validMarketParams)
      ).rejects.toThrow('User cancelled');
    });

    it('J6: handles contract validation errors gracefully', async () => {
      vi.mocked(StacksConnect.openContractCall).mockRejectedValueOnce(
        new Error('Contract error: Duration below minimum')
      );

      await expect(
        predinexContract.createMarket({
          ...validMarketParams,
          durationSeconds: 60, // Below minimum
        })
      ).rejects.toThrow('Contract error: Duration below minimum');
    });
  });
});
