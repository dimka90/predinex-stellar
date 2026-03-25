import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { render } from '../test-utils';
import Home from '@/page';
import CreateMarket from '@/create/page';
import * as StacksProvider from '@/components/StacksProvider';
import * as WalletConnection from '@/../../lib/hooks/useWalletConnection';
import * as Navigation from 'next/navigation';

// Mock the hooks
vi.mock('@/components/StacksProvider', () => ({
  useStacks: vi.fn(),
  StacksProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="stacks-provider">{children}</div>,
}));

vi.mock('@/../../lib/hooks/useWalletConnection', () => ({
  useWalletConnection: vi.fn(),
}));

// Refine next/navigation mock for routing tests
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: vi.fn(),
  useSearchParams: () => new URLSearchParams(),
}));

describe('Navbar and Auth Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('navigates from public Home (Set A) to protected Create (Set B) while signed out', async () => {
    // Set A (Home) mocks
    vi.mocked(StacksProvider.useStacks).mockReturnValue({
      userData: null,
      authenticate: vi.fn(),
      signOut: vi.fn(),
    });
    vi.mocked(Navigation.usePathname).mockReturnValue('/');

    // Render Home (Set A)
    const { unmount } = render(<Home />);
    
    // Check Set A Navbar
    expect(screen.getByLabelText('Predinex Home')).toBeInTheDocument();
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    
    unmount();

    // Set B (Create) mocks
    vi.mocked(WalletConnection.useWalletConnection).mockReturnValue({
      isConnected: false,
      address: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });
    vi.mocked(Navigation.usePathname).mockReturnValue('/create');

    // Render Create (Set B)
    render(<CreateMarket />);

    // Check Set B Navbar & AuthGuard
    expect(screen.getByText('Connect Wallet', { selector: 'button' })).toBeInTheDocument();
    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
  });

  it('shows inconsistent auth state when signed in via Set A but navigating to Set B', async () => {
    // Sign in via Set A (Stacks)
    vi.mocked(StacksProvider.useStacks).mockReturnValue({
      userData: { profile: { stxAddress: { mainnet: 'ST123' } } },
      authenticate: vi.fn(),
      signOut: vi.fn(),
    });
    vi.mocked(Navigation.usePathname).mockReturnValue('/');

    // Render Home (Set A)
    const { unmount } = render(<Home />);
    
    // Set A Navbar should show connected state
    expect(screen.queryByText('Connect Wallet')).not.toBeInTheDocument();
    // It uses truncateAddress, so look for a partial or the icon
    expect(screen.getByTitle('Sign out')).toBeInTheDocument();
    
    unmount();

    // Navigate to Create (Set B)
    // Set B still uses useWalletConnection which doesn't know about Stacks session yet
    vi.mocked(WalletConnection.useWalletConnection).mockReturnValue({
      isConnected: false,
      address: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });
    vi.mocked(Navigation.usePathname).mockReturnValue('/create');

    render(<CreateMarket />);

    // PROVE INCONSISTENCY: Set B shows "Connect Wallet" even though we are "signed in" via Set A
    // In a real app, these should both point to the same global state source.
    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    expect(screen.getByText('Connect Wallet', { selector: 'button' })).toBeInTheDocument();
  });
});
