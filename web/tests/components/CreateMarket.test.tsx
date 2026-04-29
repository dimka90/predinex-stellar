import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateMarket from '../../app/create/page';
import { predinexContract } from '../../app/lib/adapters/predinex-contract';
import * as WalletAdapterProvider from '../../app/components/WalletAdapterProvider';
import { renderWithProviders } from '../helpers/renderWithProviders';

vi.mock('../../app/components/WalletAdapterProvider', () => ({
  useWallet: vi.fn(),
  WalletAdapterProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../app/lib/adapters/predinex-contract', () => ({
  predinexContract: {
    createMarketSoroban: vi.fn(),
  },
}));

vi.mock('../../app/lib/cache-invalidation', () => ({
  invalidateOnCreatePool: vi.fn(),
}));

vi.mock('../../app/components/Navbar', () => ({
  default: () => <nav data-testid="navbar" />,
}));

vi.mock('../../app/components/AuthGuard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

const connectedWallet = {
  chain: 'stacks' as const,
  isConnected: true,
  isLoading: false,
  address: 'GBUSER123STELLARADDRESS',
  connect: mockConnect,
  disconnect: mockDisconnect,
};

const disconnectedWallet = {
  ...connectedWallet,
  isConnected: false,
  address: null,
};

function setWalletState(
  wallet: typeof connectedWallet | typeof disconnectedWallet = connectedWallet
) {
  vi.mocked(WalletAdapterProvider.useWallet).mockReturnValue(wallet as never);
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/question/i), 'Will BTC hit 100k?');
  await user.type(
    screen.getByLabelText(/description/i),
    'Resolution based on Coinbase price at midnight UTC.'
  );
  await user.type(screen.getByLabelText(/outcome a/i), 'Yes');
  await user.type(screen.getByLabelText(/outcome b/i), 'No');
  await user.clear(screen.getByLabelText(/duration/i));
  await user.type(screen.getByLabelText(/duration/i), '1440');
}

describe('CreateMarket page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setWalletState();
  });

  it('renders all form fields', () => {
    renderWithProviders(<CreateMarket />);

    expect(screen.getByLabelText(/question/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/outcome a/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/outcome b/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/duration/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create market/i })).toBeInTheDocument();
  });

  it('shows inline validation errors and blocks transaction on invalid submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateMarket />);

    await user.click(screen.getByRole('button', { name: /create market/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });

    expect(predinexContract.createMarketSoroban).not.toHaveBeenCalled();
  });

  it('shows a validation error when outcomes are identical', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateMarket />);

    await user.type(screen.getByLabelText(/question/i), 'Will BTC hit 100k?');
    await user.type(
      screen.getByLabelText(/description/i),
      'Resolution based on Coinbase price at midnight UTC.'
    );
    await user.type(screen.getByLabelText(/outcome a/i), 'Yes');
    await user.type(screen.getByLabelText(/outcome b/i), 'Yes');
    await user.type(screen.getByLabelText(/duration/i), '1440');

    await user.click(screen.getByRole('button', { name: /create market/i }));

    await waitFor(() => {
      expect(screen.getByText(/outcomes must be different/i)).toBeInTheDocument();
    });
    expect(predinexContract.createMarketSoroban).not.toHaveBeenCalled();
  });

  it('calls createMarketSoroban with correct args on valid submit', async () => {
    vi.mocked(predinexContract.createMarketSoroban).mockResolvedValue({
      txHash: 'mock-tx-id-123',
    });

    const user = userEvent.setup();
    renderWithProviders(<CreateMarket />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /create market/i }));

    await waitFor(() => {
      expect(predinexContract.createMarketSoroban).toHaveBeenCalledTimes(1);
    });

    expect(predinexContract.createMarketSoroban).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet: connectedWallet,
        title: 'Will BTC hit 100k?',
        description: 'Resolution based on Coinbase price at midnight UTC.',
        outcomeA: 'Yes',
        outcomeB: 'No',
        durationSeconds: 1440,
        onStageChange: expect.any(Function),
      })
    );
  });

  it('shows success feedback after transaction completes', async () => {
    vi.mocked(predinexContract.createMarketSoroban).mockResolvedValue({
      txHash: 'mock-tx-id-123',
    });

    const user = userEvent.setup();
    renderWithProviders(<CreateMarket />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /create market/i }));

    const status = await screen.findByRole('status');
    expect(within(status).getByText(/^market created!$/i)).toBeInTheDocument();
    expect(within(status).getByText(/mock-tx-id-123/i)).toBeInTheDocument();
  });

  it('calls connect when wallet is not connected and form is submitted', async () => {
    setWalletState(disconnectedWallet);
    const user = userEvent.setup();
    renderWithProviders(<CreateMarket />);

    await user.click(screen.getByRole('button', { name: /create market/i }));

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(predinexContract.createMarketSoroban).not.toHaveBeenCalled();
  });

  it('clears field error when user starts typing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateMarket />);

    await user.click(screen.getByRole('button', { name: /create market/i }));
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));

    await user.type(screen.getByLabelText(/question/i), 'A');

    await waitFor(() => {
      expect(screen.queryByText(/title is required/i)).not.toBeInTheDocument();
    });
  });
});
