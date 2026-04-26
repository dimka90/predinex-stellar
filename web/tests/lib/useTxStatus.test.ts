import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTxStatus } from '../../app/lib/hooks/useTxStatus';

vi.mock('../../app/lib/runtime-config', () => ({
  getRuntimeConfig: vi.fn(() => ({
    network: 'testnet',
    contract: { address: 'ST1TEST', name: 'predinex-pool', id: 'ST1TEST.predinex-pool' },
    api: { coreApiUrl: 'https://api.testnet.hiro.so', explorerUrl: '', rpcUrl: '' },
  })),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function pendingResponse() {
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ tx_status: 'pending' }) });
}
function successResponse() {
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ tx_status: 'success' }) });
}
function failedResponse() {
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ tx_status: 'abort_by_response' }) });
}

describe('useTxStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle', () => {
    const { result } = renderHook(() => useTxStatus());
    const [state] = result.current;
    expect(state.status).toBe('idle');
    expect(state.txId).toBeNull();
  });

  it('enters pending state immediately after trackTx is called', () => {
    mockFetch.mockReturnValue(pendingResponse());
    const { result } = renderHook(() => useTxStatus());

    act(() => {
      result.current[1]('tx-abc-123');
    });

    const [state] = result.current;
    expect(state.status).toBe('pending');
    expect(state.txId).toBe('tx-abc-123');
  });

  it('transitions to success when chain confirms', async () => {
    mockFetch.mockReturnValueOnce(pendingResponse()).mockReturnValue(successResponse());
    const { result } = renderHook(() => useTxStatus());

    act(() => { result.current[1]('tx-success-1'); });
    expect(result.current[0].status).toBe('pending');

    // First poll — still pending
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    // Second poll — success
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    expect(result.current[0].status).toBe('success');
    expect(result.current[0].error).toBeNull();
  });

  it('transitions to failed when chain aborts', async () => {
    mockFetch.mockReturnValueOnce(pendingResponse()).mockReturnValue(failedResponse());
    const { result } = renderHook(() => useTxStatus());

    act(() => { result.current[1]('tx-fail-1'); });

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    expect(result.current[0].status).toBe('failed');
    expect(result.current[0].error).toBe('Transaction failed on-chain.');
  });

  it('stops polling after success (fetch not called again)', async () => {
    mockFetch.mockReturnValue(successResponse());
    const { result } = renderHook(() => useTxStatus());

    act(() => { result.current[1]('tx-stop-1'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    const callsAfterSuccess = mockFetch.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(9000); });

    expect(mockFetch.mock.calls.length).toBe(callsAfterSuccess); // no more polls
  });

  it('stops polling on unmount', async () => {
    mockFetch.mockReturnValue(pendingResponse());
    const { result, unmount } = renderHook(() => useTxStatus());

    act(() => { result.current[1]('tx-unmount-1'); });
    unmount();

    const callsAtUnmount = mockFetch.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(9000); });

    expect(mockFetch.mock.calls.length).toBe(callsAtUnmount); // polling stopped
  });
});
