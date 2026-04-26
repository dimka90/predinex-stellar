/**
 * Generic retry utility with bounded exponential backoff.
 * Used by market discovery API calls to survive transient failures.
 */

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 4 */
  maxAttempts?: number;
  /** Base delay in ms for the first retry. Default: 500 */
  baseDelayMs?: number;
  /** Multiplier applied to the delay after each failure. Default: 2 */
  backoffFactor?: number;
  /** Hard cap on any single delay in ms. Default: 8000 */
  maxDelayMs?: number;
  /**
   * Predicate that decides whether an error is transient (worth retrying).
   * Non-transient errors (e.g. auth, not-found) are thrown immediately.
   * Defaults to treating all errors as transient.
   */
  isTransient?: (error: unknown) => boolean;
  /** Called after each failed attempt — useful for logging / state updates. */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/** Resolved retry configuration with all defaults filled in. */
export interface ResolvedRetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  backoffFactor: number;
  maxDelayMs: number;
  isTransient: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULTS: ResolvedRetryOptions = {
  maxAttempts: 4,
  baseDelayMs: 500,
  backoffFactor: 2,
  maxDelayMs: 8000,
  isTransient: () => true,
};

/**
 * Calculates the delay (ms) for a given retry attempt using exponential backoff
 * with full jitter to avoid thundering-herd issues.
 *
 * @param attempt    - Zero-based retry index (0 = first retry after first failure)
 * @param opts       - Resolved retry options
 */
export function computeBackoffDelay(attempt: number, opts: ResolvedRetryOptions): number {
  const exponential = opts.baseDelayMs * Math.pow(opts.backoffFactor, attempt);
  const capped = Math.min(exponential, opts.maxDelayMs);
  // Full jitter: random value in [0, capped]
  return Math.floor(Math.random() * capped);
}

/**
 * Executes `fn` with retry and exponential backoff.
 *
 * - Retries up to `maxAttempts - 1` times on transient errors.
 * - Non-transient errors (per `isTransient`) are re-thrown immediately.
 * - After all attempts are exhausted the last error is re-thrown so callers
 *   can present a final error state.
 *
 * @param fn   - Async operation to execute
 * @param opts - Retry configuration (all fields optional)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const resolved: ResolvedRetryOptions = { ...DEFAULTS, ...opts };

  let lastError: unknown;

  for (let attempt = 0; attempt < resolved.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!resolved.isTransient(error)) {
        throw error;
      }

      const isLastAttempt = attempt === resolved.maxAttempts - 1;
      if (isLastAttempt) break;

      const delayMs = computeBackoffDelay(attempt, resolved);
      resolved.onRetry?.(attempt + 1, error, delayMs);

      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
