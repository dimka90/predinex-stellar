'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getRuntimeConfig } from '../runtime-config';

export type TxStatus = 'pending' | 'success' | 'failed' | 'idle';

export interface TxState {
  status: TxStatus;
  txId: string | null;
  error: string | null;
}

const POLL_INTERVAL_MS = 3000;

async function fetchTxStatus(txId: string, coreApiUrl: string): Promise<'pending' | 'success' | 'failed'> {
  const res = await fetch(`${coreApiUrl}/extended/v1/tx/${txId}`);
  if (!res.ok) return 'pending';
  const data = await res.json();
  if (data.tx_status === 'success') return 'success';
  if (data.tx_status === 'abort_by_response' || data.tx_status === 'abort_by_post_condition') return 'failed';
  return 'pending';
}

/**
 * Tracks a Stacks transaction from submission to finalization.
 * Polls every 3 s and stops when the tx finalizes or the component unmounts.
 *
 * @returns [txState, trackTx] — call trackTx(txId) immediately after openContractCall onFinish.
 */
export function useTxStatus(): [TxState, (txId: string) => void] {
  const [state, setState] = useState<TxState>({ status: 'idle', txId: null, error: null });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const trackTx = useCallback((txId: string) => {
    stopPolling();
    setState({ status: 'pending', txId, error: null });

    const { api } = getRuntimeConfig();

    intervalRef.current = setInterval(async () => {
      try {
        const status = await fetchTxStatus(txId, api.coreApiUrl);
        if (status !== 'pending') {
          setState({ status, txId, error: status === 'failed' ? 'Transaction failed on-chain.' : null });
          stopPolling();
        }
      } catch {
        // network hiccup — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  // Clean up on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  return [state, trackTx];
}
