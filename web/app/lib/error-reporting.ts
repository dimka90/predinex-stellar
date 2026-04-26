// #248 — structured frontend error reporting with wallet and transaction redaction.
//
// Usage:
//   import { reportError } from '@/app/lib/error-reporting';
//   reportError(error, { context: 'place-bet', marketId: '42' });
//
// The hook is opt-in: set NEXT_PUBLIC_ERROR_REPORTING=true to enable. When
// disabled the module is a no-op so no data leaves the browser.

const ENABLED = process.env.NEXT_PUBLIC_ERROR_REPORTING === 'true';

// Stellar / Stacks address patterns — never logged verbatim.
const STELLAR_ADDRESS_RE = /\bG[A-Z2-7]{55}\b/g;
const STACKS_ADDRESS_RE = /\bS[MT][0-9A-Z]{38,}\b/g;
// Transaction hash — 64-char hex
const TX_HASH_RE = /\b[0-9a-f]{64}\b/gi;
// Signature blobs — long base64-ish strings
const SIGNATURE_RE = /\b[A-Za-z0-9+/]{80,}={0,2}\b/g;

export function redact(value: string): string {
  return value
    .replace(STELLAR_ADDRESS_RE, '[STELLAR_ADDRESS]')
    .replace(STACKS_ADDRESS_RE, '[STACKS_ADDRESS]')
    .replace(TX_HASH_RE, '[TX_HASH]')
    .replace(SIGNATURE_RE, '[SIGNATURE]');
}

export interface ErrorContext {
  context?: string;
  [key: string]: unknown;
}

function sanitiseContext(ctx: ErrorContext): ErrorContext {
  const out: ErrorContext = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === 'string') {
      out[k] = redact(v);
    } else {
      // Non-string values (numbers, booleans, undefined) are safe as-is.
      out[k] = v;
    }
  }
  return out;
}

/**
 * Report a runtime error through the configured reporting channel.
 * Wallet addresses, transaction hashes, and signatures are stripped before
 * any data leaves the browser.
 */
export function reportError(error: unknown, ctx: ErrorContext = {}): void {
  const message =
    error instanceof Error ? redact(error.message) : redact(String(error));
  const stack =
    error instanceof Error && error.stack ? redact(error.stack) : undefined;
  const safe = sanitiseContext(ctx);

  // Always log locally so developers see it in DevTools regardless of the flag.
  console.error('[predinex]', message, safe, stack ?? '');

  if (!ENABLED) return;

  // Replace this block with your real reporting SDK (Sentry, Datadog, etc.).
  // Example:
  //   Sentry.captureException(error, { extra: safe });
  // For now we POST to a configurable endpoint if one is provided.
  const endpoint = process.env.NEXT_PUBLIC_ERROR_ENDPOINT;
  if (!endpoint) return;

  const payload = JSON.stringify({ message, stack, context: safe, ts: Date.now() });
  // fire-and-forget; errors in the reporter must never propagate to users
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {/* intentionally silent */});
}
