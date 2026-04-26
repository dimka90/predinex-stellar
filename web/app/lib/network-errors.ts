export type ConnectivityIssue = 'offline' | 'timeout' | 'network' | 'unknown';

const OFFLINE_HINTS = ['offline', 'failed to fetch', 'network request failed', 'networkerror'];
const TIMEOUT_HINTS = ['timeout', 'timed out', 'aborterror', 'aborted'];
const NETWORK_HINTS = ['network', 'fetch', 'econn', 'enotfound', 'eai_again'];

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`.toLowerCase();
  return String(error).toLowerCase();
}

function includesAny(text: string, hints: string[]): boolean {
  return hints.some((hint) => text.includes(hint));
}

export function classifyConnectivityIssue(error: unknown): ConnectivityIssue {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'offline';
  }

  const text = toErrorMessage(error);

  if (includesAny(text, OFFLINE_HINTS)) return 'offline';
  if (includesAny(text, TIMEOUT_HINTS)) return 'timeout';
  if (includesAny(text, NETWORK_HINTS)) return 'network';
  return 'unknown';
}

export function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  if (timeoutMs <= 0) return operation;

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);

    operation
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export function getConnectivityMessage(
  issue: ConnectivityIssue,
  actionLabel: string
): string {
  switch (issue) {
    case 'offline':
      return `You appear to be offline. ${actionLabel} requires an internet connection. Reconnect and try again.`;
    case 'timeout':
      return `${actionLabel} is taking longer than expected and timed out. Please retry in a moment.`;
    case 'network':
      return `A network issue prevented ${actionLabel.toLowerCase()}. Please retry shortly.`;
    default:
      return `${actionLabel} failed. Please try again.`;
  }
}
