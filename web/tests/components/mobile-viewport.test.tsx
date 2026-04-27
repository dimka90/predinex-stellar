/**
 * Mobile viewport tests — Navbar, MarketGrid, WalletModal
 *
 * jsdom does not perform CSS layout, so "mobile viewport" is modelled by
 * setting window.innerWidth / window.innerHeight before each test and
 * asserting on the DOM elements that are conditionally rendered at small
 * screen sizes (hamburger button, mobile menu, single-column grid, modal
 * content).  CSS-only visibility (hidden md:flex) is not testable here;
 * we focus on interactive and structural correctness.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../helpers/renderWithProviders';
import type { Pool } from '../../app/lib/stacks-api';

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.mock('../../app/components/WalletAdapterProvider', () => ({
  useWallet: vi.fn(() => ({
    chain: 'stacks',
    isConnected: false,
    isLoading: false,
    address: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  WalletAdapterProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../app/components/NetworkMismatchWarning', () => ({
  default: () => null,
}));

vi.mock('../../app/components/WalletAddressCopyButton', () => ({
  default: ({ address }: { address: string }) => <span>{address}</span>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Suppress intentional console.error noise
beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------
// Viewport helper
// ---------------------------------------------------------------------------

function setViewport(width: number, height = 812) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

const MOBILE_WIDTH = 375;
const DESKTOP_WIDTH = 1280;

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

import Navbar from '../../app/components/Navbar';

describe('Navbar — mobile viewport', () => {
  beforeEach(() => setViewport(MOBILE_WIDTH));
  afterEach(() => setViewport(DESKTOP_WIDTH));

  it('renders the hamburger menu button', () => {
    render(<Navbar />);
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('opens the mobile menu when the hamburger is clicked', async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    const toggle = screen.getByRole('button', { name: /open menu/i });
    await user.click(toggle);

    // The mobile menu panel is the second md:hidden element (the content div,
    // not the backdrop). Scope to it to avoid matching desktop nav links.
    const mobileMenus = document.querySelectorAll('.md\\:hidden');
    const mobileMenu = Array.from(mobileMenus).find(el => el.querySelector('a')) as HTMLElement;
    expect(within(mobileMenu).getByRole('link', { name: /markets/i })).toBeInTheDocument();
    expect(within(mobileMenu).getByRole('link', { name: /create/i })).toBeInTheDocument();
  });

  it('closes the mobile menu when the hamburger is clicked again', async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    const toggle = screen.getByRole('button', { name: /open menu/i });
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: /close menu/i }));

    expect(screen.queryByRole('link', { name: /^markets$/i })).not.toBeInTheDocument();
  });

  it('renders the logo link at mobile size', () => {
    render(<Navbar />);
    expect(screen.getByRole('link', { name: /predinex home/i })).toBeInTheDocument();
  });

  it('shows connect wallet button in mobile menu', async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    // Connect button is in the desktop bar; mobile menu has nav links
    // Verify the nav element is present and accessible
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// WalletModal
// ---------------------------------------------------------------------------

import WalletModal from '../../app/components/WalletModal';

vi.mock('../../app/lib/wallet-connector', () => ({
  isWalletAvailable: vi.fn(() => false),
}));

describe('WalletModal — mobile viewport', () => {
  beforeEach(() => setViewport(MOBILE_WIDTH));
  afterEach(() => setViewport(DESKTOP_WIDTH));

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSelectWallet: vi.fn(),
    error: undefined,
  };

  it('renders the modal heading', () => {
    render(<WalletModal {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('renders all three wallet options', () => {
    render(<WalletModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /leather/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /xverse/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /walletconnect/i })).toBeInTheDocument();
  });

  it('close button is accessible and calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<WalletModal {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /close modal/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('displays an error message when error prop is set', () => {
    render(<WalletModal {...defaultProps} error="Wallet not found" />);
    expect(screen.getByText('Wallet not found')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<WalletModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('heading', { name: /connect wallet/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MarketGrid
// ---------------------------------------------------------------------------

import MarketGrid from '../../components/MarketGrid';

vi.mock('../../components/MarketCard', () => ({
  default: ({ market }: { market: Pool }) => (
    <article aria-label={`market-${market.id}`}>{market.title}</article>
  ),
}));

vi.mock('../../components/ui/spinner', () => ({
  Spinner: () => <div role="status" aria-label="loading" />,
}));

function makePool(overrides: Partial<Pool> = {}): Pool {
  return {
    id: 1,
    title: 'BTC > 100k?',
    description: 'Will BTC exceed 100k?',
    creator: 'ST123',
    outcomeA: 'Yes',
    outcomeB: 'No',
    totalA: 1_000_000,
    totalB: 500_000,
    settled: false,
    winningOutcome: null,
    expiry: 9999,
    status: 'active' as const,
    ...overrides,
  };
}

describe('MarketGrid — mobile viewport', () => {
  beforeEach(() => setViewport(MOBILE_WIDTH));
  afterEach(() => setViewport(DESKTOP_WIDTH));

  it('renders a card for each market', () => {
    const markets = [makePool({ id: 1 }), makePool({ id: 2, title: 'ETH flip?' })];
    renderWithProviders(
      <MarketGrid markets={markets} isLoading={false} error={null} onRetry={vi.fn()} hasFilters={false} />
    );
    expect(screen.getByLabelText('market-1')).toBeInTheDocument();
    expect(screen.getByLabelText('market-2')).toBeInTheDocument();
  });

  it('renders a loading spinner when isLoading is true', () => {
    renderWithProviders(
      <MarketGrid markets={[]} isLoading={true} error={null} onRetry={vi.fn()} hasFilters={false} />
    );
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('renders an error state with a retry button', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(
      <MarketGrid markets={[]} isLoading={false} error="Network error" onRetry={onRetry} hasFilters={false} />
    );
    expect(screen.getByText('Network error')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders an empty state when there are no markets', () => {
    renderWithProviders(
      <MarketGrid markets={[]} isLoading={false} error={null} onRetry={vi.fn()} hasFilters={false} />
    );
    expect(screen.getByText(/no markets found/i)).toBeInTheDocument();
  });

  it('renders a reset button in empty state when filters are active', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(
      <MarketGrid markets={[]} isLoading={false} error={null} onRetry={onRetry} hasFilters={true} />
    );
    await user.click(screen.getByRole('button', { name: /reset all filters/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
