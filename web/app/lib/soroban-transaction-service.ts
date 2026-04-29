import {
  Address,
  Contract,
  nativeToScVal,
  Networks,
  rpc,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { FreighterWalletClient } from './freighter-adapter';

export interface SorobanTxResult {
  status: 'SUCCESS' | 'FAILED';
  txHash: string;
  returnValue?: any;
  error?: string;
}

export type TxStage =
  | 'idle'
  | 'simulating'
  | 'signing'
  | 'submitting'
  | 'polling'
  | 'success'
  | 'error';

export class SorobanTransactionService {
  private server: rpc.Server;
  private networkPassphrase: string;

  constructor(rpcUrl: string, network: 'mainnet' | 'testnet') {
    this.server = new rpc.Server(rpcUrl);
    this.networkPassphrase = network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
  }

  private async executeWithFeePrompt(
    tx: Transaction,
    wallet: FreighterWalletClient,
    onStageChange?: (stage: TxStage) => void,
    onFeeEstimated?: (feeStroops: string) => Promise<boolean>
  ): Promise<SorobanTxResult> {
    onStageChange?.('simulating');
    const simulation = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`Simulation failed: ${simulation.error}`);
    }

    const assembledTx = rpc.assembleTransaction(tx, simulation).build();

    if (onFeeEstimated) {
      const proceed = await onFeeEstimated(assembledTx.fee);
      if (!proceed) {
        throw new Error('Transaction cancelled by user');
      }
    }

    onStageChange?.('signing');
    const xdrString = assembledTx.toXDR();
    const signedXdr = await wallet.signTransaction(xdrString, {
      networkPassphrase: this.networkPassphrase,
    });
    const signedTx = new Transaction(signedXdr, this.networkPassphrase);

    onStageChange?.('submitting');
    const submission = await this.server.sendTransaction(signedTx);
    if (submission.status === 'ERROR') {
      throw new Error(`Submission failed: ${JSON.stringify(submission.errorResult)}`);
    }

    onStageChange?.('polling');
    const result = await this.pollForSuccess(submission.hash);
    onStageChange?.('success');
    return result;
  }

  async createPool(
    wallet: FreighterWalletClient,
    contractId: string,
    params: {
      title: string;
      description: string;
      outcomeA: string;
      outcomeB: string;
      duration: number;
    },
    onStageChange?: (stage: TxStage) => void,
    onFeeEstimated?: (feeStroops: string) => Promise<boolean>
  ): Promise<SorobanTxResult> {
    if (!wallet.address) throw new Error('Wallet not connected');

    const contract = new Contract(contractId);
    const sourceAccount = await this.server.getAccount(wallet.address);

    const tx = new TransactionBuilder(sourceAccount, {
      fee: '1000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'create_pool',
          new Address(wallet.address).toScVal(),
          nativeToScVal(params.title),
          nativeToScVal(params.description),
          nativeToScVal(params.outcomeA),
          nativeToScVal(params.outcomeB),
          nativeToScVal(params.duration, { type: 'u64' })
        )
      )
      .setTimeout(30)
      .build();

    return this.executeWithFeePrompt(tx, wallet, onStageChange, onFeeEstimated);
  }

  async placeBet(
    wallet: FreighterWalletClient,
    contractId: string,
    params: { poolId: number; outcome: number; amountStroops: number },
    onStageChange?: (stage: TxStage) => void,
    onFeeEstimated?: (feeStroops: string) => Promise<boolean>
  ): Promise<SorobanTxResult> {
    if (!wallet.address) throw new Error('Wallet not connected');

    const contract = new Contract(contractId);
    const sourceAccount = await this.server.getAccount(wallet.address);

    const tx = new TransactionBuilder(sourceAccount, {
      fee: '1000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'place_bet',
          new Address(wallet.address).toScVal(),
          nativeToScVal(params.poolId, { type: 'u32' }),
          nativeToScVal(params.outcome, { type: 'u32' }),
          nativeToScVal(params.amountStroops, { type: 'i128' })
        )
      )
      .setTimeout(30)
      .build();

    return this.executeWithFeePrompt(tx, wallet, onStageChange, onFeeEstimated);
  }

  async claimWinnings(
    wallet: FreighterWalletClient,
    contractId: string,
    params: { poolId: number },
    onStageChange?: (stage: TxStage) => void,
    onFeeEstimated?: (feeStroops: string) => Promise<boolean>
  ): Promise<SorobanTxResult> {
    if (!wallet.address) throw new Error('Wallet not connected');

    const contract = new Contract(contractId);
    const sourceAccount = await this.server.getAccount(wallet.address);

    const tx = new TransactionBuilder(sourceAccount, {
      fee: '1000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'claim_winnings',
          new Address(wallet.address).toScVal(),
          nativeToScVal(params.poolId, { type: 'u32' })
        )
      )
      .setTimeout(30)
      .build();

    return this.executeWithFeePrompt(tx, wallet, onStageChange, onFeeEstimated);
  }

  async settlePool(
    wallet: FreighterWalletClient,
    contractId: string,
    params: { poolId: number; winningOutcome: number },
    onStageChange?: (stage: TxStage) => void,
    onFeeEstimated?: (feeStroops: string) => Promise<boolean>
  ): Promise<SorobanTxResult> {
    if (!wallet.address) throw new Error('Wallet not connected');

    const contract = new Contract(contractId);
    const sourceAccount = await this.server.getAccount(wallet.address);

    const tx = new TransactionBuilder(sourceAccount, {
      fee: '1000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'settle_pool',
          new Address(wallet.address).toScVal(),
          nativeToScVal(params.poolId, { type: 'u32' }),
          nativeToScVal(params.winningOutcome, { type: 'u32' })
        )
      )
      .setTimeout(30)
      .build();

    return this.executeWithFeePrompt(tx, wallet, onStageChange, onFeeEstimated);
  }

  private async pollForSuccess(txHash: string): Promise<SorobanTxResult> {
    let attempts = 0;
    while (attempts < 20) {
      const response = await this.server.getTransaction(txHash);
      if (response.status === 'SUCCESS') {
        return {
          status: 'SUCCESS',
          txHash,
          returnValue: response.returnValue,
        };
      }
      if (response.status === 'FAILED') {
        return {
          status: 'FAILED',
          txHash,
          error: 'Transaction failed on-chain',
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('Transaction polling timed out');
  }
}
