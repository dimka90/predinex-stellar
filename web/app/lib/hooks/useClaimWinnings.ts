'use client';

import { useCallback, useState } from 'react';
import { useToast } from '@/providers/ToastProvider';
import { predinexContract } from '../adapters/predinex-contract';
import { invalidateOnClaimWinnings } from '../cache-invalidation';

export type ClaimTxStatus = 'pending' | 'success' | 'failed';

export interface ClaimTxState {
  status: ClaimTxStatus;
  txId?: string;
  error?: string;
}

export function useClaimWinnings(userAddress?: string | null) {
  const { showToast } = useToast();
  const [claimTransactions, setClaimTransactions] = useState<Map<number, ClaimTxState>>(new Map());

  const claim = useCallback(
    async (poolId: number, onSuccess?: () => void) => {
      setClaimTransactions((prev) => new Map(prev).set(poolId, { status: 'pending' }));

      try {
        await predinexContract.claimWinnings({
          poolId,
          onFinish: (data) => {
            if (userAddress) {
              invalidateOnClaimWinnings({ poolId, userAddress });
            }

            const txId = data?.txId;
            setClaimTransactions((prev) =>
              new Map(prev).set(poolId, { status: 'success', txId })
            );
            showToast('Claim submitted successfully!', 'success');
            onSuccess?.();
          },
          onCancel: () => {
            setClaimTransactions((prev) => {
              const next = new Map(prev);
              next.delete(poolId);
              return next;
            });
            showToast('Claim transaction cancelled', 'info');
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to claim winnings';
        setClaimTransactions((prev) =>
          new Map(prev).set(poolId, { status: 'failed', error: message })
        );
        showToast(message, 'error');
        throw error;
      }
    },
    [showToast, userAddress]
  );

  return { claimTransactions, claim };
}
