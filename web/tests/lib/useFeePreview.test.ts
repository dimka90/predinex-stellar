import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFeePreview, PROTOCOL_FEE_STX } from '../../app/lib/hooks/useFeePreview';

describe('useFeePreview', () => {
  it('shows a fee preview with empty inputs', () => {
    const { result } = renderHook(() => useFeePreview('', ''));
    const { protocolFee, networkFee, total } = result.current;

    expect(protocolFee).toBe(PROTOCOL_FEE_STX);
    expect(networkFee).toBeGreaterThan(0);
    expect(total).toBeCloseTo(protocolFee + networkFee, 6);
  });

  it('distinguishes protocol fee from network fee', () => {
    const { result } = renderHook(() => useFeePreview('Will BTC hit 100k?', 'Some description'));
    const { protocolFee, networkFee } = result.current;

    expect(protocolFee).toBe(PROTOCOL_FEE_STX);
    expect(networkFee).not.toBe(protocolFee);
  });

  it('network fee increases when title and description grow', () => {
    const { result: short } = renderHook(() => useFeePreview('Hi', 'Ok'));
    const { result: long } = renderHook(() =>
      useFeePreview(
        'Will Bitcoin exceed one hundred thousand dollars by the end of 2025?',
        'Resolution based on the Coinbase spot price at midnight UTC on December 31st 2025.'
      )
    );

    expect(long.current.networkFee).toBeGreaterThan(short.current.networkFee);
  });

  it('total equals protocolFee + networkFee', () => {
    const { result } = renderHook(() => useFeePreview('Test market', 'A description for testing'));
    const { protocolFee, networkFee, total } = result.current;
    expect(total).toBeCloseTo(protocolFee + networkFee, 6);
  });

  it('updates when inputs change', () => {
    const { result, rerender } = renderHook(
      ({ title, desc }: { title: string; desc: string }) => useFeePreview(title, desc),
      { initialProps: { title: '', desc: '' } }
    );
    const feeBefore = result.current.networkFee;

    rerender({ title: 'A longer title that adds characters', desc: 'More description text here' });

    expect(result.current.networkFee).toBeGreaterThan(feeBefore);
  });
});
