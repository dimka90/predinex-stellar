import { truncateAddress } from '../utils';

export function formatDisputeAddress(address: string): string {
  return truncateAddress(address);
}

export function formatMicroStx(microSTX: number): string {
  return (microSTX / 1_000_000).toFixed(2);
}

export function formatVotingTimeRemaining(deadline: number, now: number): string {
  if (now === 0) return 'Loading...';
  const remaining = deadline - now;

  if (remaining <= 0) return 'Expired';

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m remaining`;
}
