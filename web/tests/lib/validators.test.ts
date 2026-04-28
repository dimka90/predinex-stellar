import { describe, it, expect } from 'vitest';
import {
  validateContractId,
  validateDuration,
  MIN_POOL_DURATION_SECS,
  MAX_POOL_DURATION_SECS,
} from '../../app/lib/validators';

describe('validateContractId', () => {
  describe('valid identifiers', () => {
    it('accepts a valid Soroban contract identifier', () => {
      const result = validateContractId(
        'CCZABC7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V',
        'mainnet'
      );
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('missing or empty input', () => {
    it('rejects an empty string', () => {
      const result = validateContractId('', 'testnet');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/required/i);
    });

    it('rejects a whitespace-only string', () => {
      const result = validateContractId('   ', 'testnet');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/required/i);
    });
  });

  describe('malformed identifiers', () => {
    it('rejects an identifier that is too short', () => {
      const result = validateContractId('CSHORT', 'testnet');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/contract identifier/i);
    });

    it('rejects an identifier with invalid characters', () => {
      const result = validateContractId(
        'C1ZABC7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V7V',
        'testnet'
      );
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Soroban contract IDs/i);
    });
  });
});

describe('validateDuration (issue #151)', () => {
  it('exposes the contract minimum as 300 seconds', () => {
    expect(MIN_POOL_DURATION_SECS).toBe(300);
  });

  it('rejects 0 with a "greater than 0" error', () => {
    const result = validateDuration(0);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/greater than 0/i);
  });

  it('rejects a negative duration', () => {
    const result = validateDuration(-1);
    expect(result.valid).toBe(false);
  });

  it('rejects a duration just below the contract minimum', () => {
    const result = validateDuration(MIN_POOL_DURATION_SECS - 1);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/at least 300 seconds/i);
  });

  it('accepts a duration exactly at the contract minimum', () => {
    const result = validateDuration(MIN_POOL_DURATION_SECS);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts a typical duration well above the minimum', () => {
    const result = validateDuration(3600);
    expect(result.valid).toBe(true);
  });

  it('rejects a duration above the soft upper bound', () => {
    const result = validateDuration(MAX_POOL_DURATION_SECS + 1);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/less than/i);
  });

  it('accepts a duration exactly at the upper bound', () => {
    const result = validateDuration(MAX_POOL_DURATION_SECS);
    expect(result.valid).toBe(true);
  });
});
