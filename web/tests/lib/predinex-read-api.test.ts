import { describe, it, expect, vi } from 'vitest';
import * as stacksApi from '../../app/lib/stacks-api';
import { predinexReadApi } from '../../app/lib/adapters/predinex-read-api';

describe('predinexReadApi', () => {
  it('delegates getPool to stacks-api', () => {
    expect(predinexReadApi.getPool).toBe(stacksApi.getPool);
  });

  it('delegates getUserBet to stacks-api', () => {
    expect(predinexReadApi.getUserBet).toBe(stacksApi.getUserBet);
  });
});
