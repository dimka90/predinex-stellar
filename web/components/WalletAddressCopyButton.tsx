'use client';

import { Wallet } from 'lucide-react';
import { formatDisplayAddress } from '../app/lib/address-display';
import { useCopyToClipboard } from '../app/lib/hooks/useCopyToClipboard';
import { ICON_CLASS } from '../app/lib/constants';

interface WalletAddressCopyButtonProps {
  address: string;
  className?: string;
}

/**
 * Navbar-style control: shows truncated address, copies full address on click, with accessible feedback.
 */
export function WalletAddressCopyButton({ address, className = '' }: WalletAddressCopyButtonProps) {
  const { copy, status } = useCopyToClipboard();

  const visibleText =
    status === 'copied' ? 'Copied!' : status === 'error' ? 'Copy failed' : formatDisplayAddress(address);

  const ariaLabel =
    status === 'copied'
      ? 'Address copied to clipboard'
      : status === 'error'
        ? 'Copy failed — click to try again'
        : `Copy wallet address ${address}`;

  return (
    <div className="relative inline-flex flex-col items-stretch">
      <button
        type="button"
        onClick={() => copy(address)}
        className={`flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full border border-border hover:bg-muted transition-colors group relative focus:outline-none focus:ring-2 focus:ring-primary/50 ${className}`}
        title={status === 'copied' ? 'Copied!' : 'Copy full address to clipboard'}
        aria-label={ariaLabel}
      >
        <Wallet className={ICON_CLASS.sm + ' text-primary'} aria-hidden />
        <span className="text-sm font-mono font-medium">{visibleText}</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {status === 'copied' && 'Address copied to clipboard.'}
        {status === 'error' && 'Could not copy address. You can try again.'}
      </span>
    </div>
  );
}
