'use client';

/**
 * @deprecated This file is maintained for backward compatibility.
 * Please import from './WalletProvider' instead for new code.
 * 
 * StacksProvider has been renamed to WalletProvider to reflect the
 * chain-agnostic wallet architecture. useStacks has been renamed to useWallet.
 */

export { WalletProvider as StacksProvider, useWallet as useStacks } from './WalletProvider';
