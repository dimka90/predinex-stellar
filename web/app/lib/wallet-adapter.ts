export type WalletChain = 'stacks';

/**
 * Chain-agnostic wallet operations that the UI needs.
 * Components should depend on this interface rather than chain SDK types.
 */
export interface WalletClient {
  chain: WalletChain;
  isLoading: boolean;
  isConnected: boolean;
  address: string | null;
  connect: () => void;
  disconnect: () => void;
}

