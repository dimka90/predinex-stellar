import { describe, it, expect, vi } from 'vitest';
import {
  MIN_BET_STX,
  toastMessages,
  connectivityErrorToast,
  showToastPayload,
} from '../../lib/toast-messages';

describe('toastMessages catalog', () => {
  it('uses MIN_BET_STX in min bet toast copy', () => {
    const payload = toastMessages.bet.minBet();
    expect(payload.message).toContain(String(MIN_BET_STX));
    expect(payload.type).toBe('error');
  });

  it('exposes success, info, warning, and error entries', () => {
    expect(toastMessages.bet.success.type).toBe('success');
    expect(toastMessages.bet.transactionCancelled.type).toBe('info');
    expect(toastMessages.network.slowConfirmation.type).toBe('warning');
    expect(toastMessages.bet.invalidAmount.type).toBe('error');
  });
});

describe('connectivityErrorToast', () => {
  it('delegates copy to getConnectivityMessage', () => {
    const payload = connectivityErrorToast('offline', 'Connecting wallet');
    expect(payload.message).toMatch(/offline/i);
    expect(payload.type).toBe('error');
  });
});

describe('showToastPayload', () => {
  it('forwards message and type to showToast', () => {
    const showToast = vi.fn();
    showToastPayload(showToast, toastMessages.bet.success);
    expect(showToast).toHaveBeenCalledWith(
      toastMessages.bet.success.message,
      toastMessages.bet.success.type
    );
  });
});
