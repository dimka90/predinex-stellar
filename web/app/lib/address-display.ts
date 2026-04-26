import { truncateAddress } from './utils';

/**
 * Canonical truncation for Stacks addresses across wallet UI, navbars, cards, and lists.
 * Single place to adjust visible character counts app-wide.
 */
export const WALLET_ADDRESS_DISPLAY = { start: 6, end: 4 } as const;

/**
 * Formats a Stacks address for display (e.g. in nav, portfolio, leaderboards, creator lines).
 */
export function formatDisplayAddress(address: string): string {
  if (!address) return '';
  return truncateAddress(
    address,
    WALLET_ADDRESS_DISPLAY.start,
    WALLET_ADDRESS_DISPLAY.end
  );
}
