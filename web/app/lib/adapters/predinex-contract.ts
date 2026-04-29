/**
 * Write-side adapter: Stacks Connect contract calls for the Predinex pool contract.
 * Keeps `openContractCall`, Clarity encoding, and contract identity out of UI components.
 */
import { openContractCall } from '@stacks/connect';
import type { Finished } from '@stacks/connect';
import { uintCV, stringAsciiCV } from '@stacks/transactions';
import { getRuntimeConfig } from '../runtime-config';
import { callContract } from '../../../lib/appkit-transactions';
import { SorobanTransactionService, TxStage } from '../soroban-transaction-service';
import { FreighterWalletClient } from '../freighter-adapter';

let sorobanService: SorobanTransactionService | null = null;

function getSorobanService() {
  if (!sorobanService) {
    const { soroban, network } = getRuntimeConfig();
    sorobanService = new SorobanTransactionService(soroban.rpcUrl, network);
  }
  return sorobanService;
}

export const predinexContract = {
  /**
   * Submit a `place-bet` contract call (wallet prompt).
   */
  async placeBet(params: {
    poolId: number;
    outcome: number;
    amountMicroStx: number;
    onFinish?: Finished;
    onCancel?: () => void;
  }): Promise<void> {
    const { contract } = getRuntimeConfig();
    await openContractCall({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'place-bet',
      functionArgs: [uintCV(params.poolId), uintCV(params.outcome), uintCV(params.amountMicroStx)],
      onFinish: params.onFinish,
      onCancel: params.onCancel,
    });
  },

  /**
   * Submit a `claim-winnings` contract call via the shared AppKit/network-aware path.
   */
  async claimWinnings(params: {
    poolId: number;
    onFinish?: Finished;
    onCancel?: () => void;
  }): Promise<void> {
    const cfg = getRuntimeConfig();
    const { contract } = cfg;
    await callContract({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'claim-winnings',
      functionArgs: [uintCV(params.poolId)],
      network: cfg.network,
      onFinish: params.onFinish,
      onCancel: params.onCancel,
    });
  },

  /**
   * Submit a `create-pool` contract call (wallet prompt).
   */
  async createMarket(params: {
    title: string;
    description: string;
    outcomeA: string;
    outcomeB: string;
    durationSeconds: number;
    onFinish?: Finished;
    onCancel?: () => void;
  }): Promise<void> {
    const { contract } = getRuntimeConfig();
    await openContractCall({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'create-pool',
      functionArgs: [
        stringAsciiCV(params.title),
        stringAsciiCV(params.description),
        stringAsciiCV(params.outcomeA),
        stringAsciiCV(params.outcomeB),
        uintCV(params.durationSeconds),
      ],
      onFinish: params.onFinish,
      onCancel: params.onCancel,
    });
  },

  /**
   * Submit a `create_pool` Soroban contract call (wallet prompt).
   */
  async createMarketSoroban(params: {
    wallet: FreighterWalletClient;
    title: string;
    description: string;
    outcomeA: string;
    outcomeB: string;
    durationSeconds: number;
    onStageChange?: (stage: TxStage) => void;
    onFeeEstimated?: (feeStroops: string) => Promise<boolean>;
  }): Promise<{ txHash: string }> {
    const { soroban } = getRuntimeConfig();
    const service = getSorobanService();

    const result = await service.createPool(
      params.wallet,
      soroban.contractId,
      {
        title: params.title,
        description: params.description,
        outcomeA: params.outcomeA,
        outcomeB: params.outcomeB,
        duration: params.durationSeconds,
      },
      params.onStageChange,
      params.onFeeEstimated
    );

    if (result.status === 'FAILED') {
      throw new Error(result.error || 'Transaction failed');
    }

    return { txHash: result.txHash };
  },

  /**
   * Submit a `place_bet` Soroban contract call (wallet prompt).
   */
  async placeBetSoroban(params: {
    wallet: FreighterWalletClient;
    poolId: number;
    outcome: number;
    amountStroops: number;
    onStageChange?: (stage: TxStage) => void;
    onFeeEstimated?: (feeStroops: string) => Promise<boolean>;
  }): Promise<{ txHash: string }> {
    const { soroban } = getRuntimeConfig();
    const service = getSorobanService();

    const result = await service.placeBet(
      params.wallet,
      soroban.contractId,
      {
        poolId: params.poolId,
        outcome: params.outcome,
        amountStroops: params.amountStroops,
      },
      params.onStageChange,
      params.onFeeEstimated
    );

    if (result.status === 'FAILED') {
      throw new Error(result.error || 'Transaction failed');
    }

    return { txHash: result.txHash };
  },

  /**
   * Submit a `claim_winnings` Soroban contract call (wallet prompt).
   */
  async claimWinningsSoroban(params: {
    wallet: FreighterWalletClient;
    poolId: number;
    onStageChange?: (stage: TxStage) => void;
    onFeeEstimated?: (feeStroops: string) => Promise<boolean>;
  }): Promise<{ txHash: string }> {
    const { soroban } = getRuntimeConfig();
    const service = getSorobanService();

    const result = await service.claimWinnings(
      params.wallet,
      soroban.contractId,
      { poolId: params.poolId },
      params.onStageChange,
      params.onFeeEstimated
    );

    if (result.status === 'FAILED') {
      throw new Error(result.error || 'Transaction failed');
    }

    return { txHash: result.txHash };
  },

  /**
   * Submit a `settle_pool` Soroban contract call (wallet prompt).
   */
  async settlePoolSoroban(params: {
    wallet: FreighterWalletClient;
    poolId: number;
    winningOutcome: number;
    onStageChange?: (stage: TxStage) => void;
    onFeeEstimated?: (feeStroops: string) => Promise<boolean>;
  }): Promise<{ txHash: string }> {
    const { soroban } = getRuntimeConfig();
    const service = getSorobanService();

    const result = await service.settlePool(
      params.wallet,
      soroban.contractId,
      { poolId: params.poolId, winningOutcome: params.winningOutcome },
      params.onStageChange,
      params.onFeeEstimated
    );

    if (result.status === 'FAILED') {
      throw new Error(result.error || 'Transaction failed');
    }

    return { txHash: result.txHash };
  },
};
