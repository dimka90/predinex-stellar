import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRuntimeConfig, __resetRuntimeConfigForTests } from '../../app/lib/runtime-config';

describe('runtime-config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    __resetRuntimeConfigForTests();
    process.env = { ...originalEnv };
  });

  it('resolves typed config for mainnet', () => {
    process.env.NEXT_PUBLIC_NETWORK = 'mainnet';

    const cfg = getRuntimeConfig();

    expect(cfg.network).toBe('mainnet');
    expect(cfg.contract.id).toContain('.');
    expect(cfg.contract.address).toBeTypeOf('string');
    expect(cfg.contract.name).toBeTypeOf('string');

    // API URLs should be present (from walletconnect-config).
    expect(cfg.api.coreApiUrl).toBeTypeOf('string');
    expect(cfg.api.coreApiUrl.length).toBeGreaterThan(0);
    expect(cfg.api.explorerUrl).toBeTypeOf('string');
    expect(cfg.api.rpcUrl).toBeTypeOf('string');
  });

  it('fails fast with actionable error when NEXT_PUBLIC_NETWORK is missing', () => {
    delete process.env.NEXT_PUBLIC_NETWORK;

    expect(() => getRuntimeConfig()).toThrow(/Missing required config: NEXT_PUBLIC_NETWORK/i);
  });

  it('fails fast with actionable error when NEXT_PUBLIC_NETWORK is invalid', () => {
    process.env.NEXT_PUBLIC_NETWORK = 'devnet';

    expect(() => getRuntimeConfig()).toThrow(/Invalid config NEXT_PUBLIC_NETWORK/i);
  });
});

