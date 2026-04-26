import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock wallet connection hook with async factory
vi.mock('@/app/hooks/useWalletConnection', async () => {
  const { vi } = await import('vitest');
  return {
    useWalletConnection: vi.fn(() => ({
      leather: false,
      xverse: false,
      walletconnect: true,
      hasAnyWallet: true,
    })),
    useWalletState: vi.fn(() => ({
      isConnected: false,
      address: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
  };
});
