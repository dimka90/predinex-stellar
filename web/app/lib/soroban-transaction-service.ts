import {
  TransactionBuilder,
  Networks,
  Address,
  xdr,
  StrKey,
  Contract,
  nativeToScVal,
  rpc,
  Transaction,
} from '@stellar/stellar-sdk';
import { FreighterWalletClient } from './freighter-adapter';

export interface SorobanTxResult {
  status: 'SUCCESS' | 'FAILED';
  txHash: string;
  returnValue?: any;
  error?: string;
}

export type TxStage = 'idle' | 'simulating' | 'signing' | 'submitting' | 'polling' | 'success' | 'error';

export class SorobanTransactionService {
  private server: rpc.Server;
  private networkPassphrase: string;

  constructor(rpcUrl: string, network: 'mainnet' | 'testnet') {
    this.server = new rpc.Server(rpcUrl);
    this.networkPassphrase = network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
  }

  /**
   * High-level helper to create a prediction pool.
   */
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
    onStageChange?: (stage: TxStage) => void
  ): Promise<SorobanTxResult> {
    if (!wallet.address) throw new Error('Wallet not connected');

    const contract = new Contract(contractId);
    const sourceAccount = await this.server.getAccount(wallet.address);

    // 1. Build the initial transaction
    const tx = new TransactionBuilder(sourceAccount, {
      fee: '1000', // Base fee, will be adjusted by simulation
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

    // 2. Simulate
    onStageChange?.('simulating');
    const simulation = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`Simulation failed: ${simulation.error}`);
    }

    // 3. Assemble and adjust fees
    const assembledTx = rpc.assembleTransaction(tx, simulation).build();

    // 4. Sign via Freighter
    onStageChange?.('signing');
    const xdrString = assembledTx.toXDR();
    const signedXdr = await wallet.signTransaction(xdrString, {
      networkPassphrase: this.networkPassphrase,
    });
    const signedTx = new Transaction(signedXdr, this.networkPassphrase);

    // 5. Submit
    onStageChange?.('submitting');
    const submission = await this.server.sendTransaction(signedTx);
    if (submission.status === 'ERROR') {
      throw new Error(`Submission failed: ${JSON.stringify(submission.errorResult)}`);
    }

    // 6. Poll for result
    onStageChange?.('polling');
    const result = await this.pollForSuccess(submission.hash);
    onStageChange?.('success');
    return result;
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
      } else if (response.status === 'FAILED') {
        return {
          status: 'FAILED',
          txHash,
          error: 'Transaction failed on-chain',
        };
      }
      // Wait 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }
    throw new Error('Transaction polling timed out');
  }
}
