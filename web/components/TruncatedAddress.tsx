'use client';

import { formatDisplayAddress } from '../app/lib/address-display';

interface TruncatedAddressProps {
  address: string;
  className?: string;
}

/**
 * Read-only truncated address with full value in tooltip and screen reader label.
 */
export function TruncatedAddress({ address, className }: TruncatedAddressProps) {
  return (
    <span className={className} title={address} aria-label={address}>
      {formatDisplayAddress(address)}
    </span>
  );
}
