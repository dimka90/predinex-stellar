import { openContractCall } from '@stacks/connect';
import type { Finished } from '@stacks/connect';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import { PostConditionMode, ClarityValue } from '@stacks/transactions';

export async function callContract(params: {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  network?: 'mainnet' | 'testnet';
  onFinish?: Finished;
  onCancel?: () => void;
}) {
  const network = params.network === 'testnet' ? STACKS_TESTNET : STACKS_MAINNET;

  await openContractCall({
    network,
    contractAddress: params.contractAddress,
    contractName: params.contractName,
    functionName: params.functionName,
    functionArgs: params.functionArgs,
    postConditionMode: PostConditionMode.Allow,
    onFinish: params.onFinish,
    onCancel: params.onCancel,
  });
}
