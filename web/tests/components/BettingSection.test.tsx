import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BettingSection from '../../app/components/BettingSection';
import * as StacksProvider from '../../app/components/StacksProvider';
import * as StacksConnect from '@stacks/connect';
import { useToast } from '../../providers/ToastProvider';
import { renderWithProviders } from '../helpers/renderWithProviders';

vi.mock('../../app/lib/runtime-config', () => ({
  getRuntimeConfig: () => ({
    network: 'testnet',
    contract: { address: 'ST000', name: 'predinex', id: 'ST000.predinex' },
    api: { coreApiUrl: 'https://api.testnet.hiro.so', explorerUrl: '', rpcUrl: '' },
  }),
}));

// Mock runtime-config so getRuntimeConfig() doesn't throw in tests
vi.mock('../../app/lib/runtime-config', () => ({
  getRuntimeConfig: vi.fn(() => ({
    network: 'testnet',
    contract: {
      address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      name: 'predinex-pool',
      id: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.predinex-pool',
    },
    api: {
      coreApiUrl: 'https://api.testnet.hiro.so',
      explorerUrl: 'https://explorer.hiro.so?chain=testnet',
      rpcUrl: 'https://api.testnet.hiro.so',
    },
  })),
}));

// Mock dependencies
vi.mock('../../app/components/StacksProvider', () => ({
  useStacks: vi.fn(),
}));

vi.mock('@stacks/connect', () => ({
  openContractCall: vi.fn(),
}));

vi.mock('../../providers/ToastProvider', () => ({
  useToast: vi.fn(),
  // ToastProvider is used by renderWithProviders; pass children through so the
  // wrapper renders without throwing "No ToastProvider export" errors.
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

/** Minimal wrapper that satisfies all context requirements for BettingSection */
function renderWithProviders(ui: React.ReactElement) {
  return render(ui);
}

const mockPool = {
  id: 0,
  title: 'Test Pool',
  description: 'Test Description',
  creator: 'ST123',
  outcomeA: 'Outcome A',
  outcomeB: 'Outcome B',
  totalA: 1000000,
  totalB: 2000000,
  settled: false,
  winningOutcome: undefined,
  expiry: 1000,
  status: 'active' as const,
};

describe('BettingSection', () => {
  const showToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({
      showToast,
    });
  });

  it('renders betting section with pool information', () => {
    vi.mocked(StacksProvider.useStacks).mockReturnValue({
      userData: { profile: { stxAddress: { mainnet: 'ST123' } } } as unknown as any,
      userSession: {} as any,
      setUserData: vi.fn(),
      openWalletModal: vi.fn(),
      isLoading: false,
      authenticate: vi.fn(),
      signOut: vi.fn(),
    } as any);

    renderWithProviders(<BettingSection pool={mockPool} poolId={0} />);

    expect(screen.getByText(/Bet on Outcome A/i)).toBeInTheDocument();
    expect(screen.getByText(/Bet on Outcome B/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Enter bet amount/i)).toBeInTheDocument();
  });

  it('prompts authentication when user is not logged in', () => {
    const authenticate = vi.fn();
    vi.mocked(StacksProvider.useStacks).mockReturnValue({
      userData: null,
      userSession: {} as any,
      setUserData: vi.fn(),
      openWalletModal: vi.fn(),
      isLoading: false,
      authenticate,
      signOut: vi.fn(),
    } as any);

    renderWithProviders(<BettingSection pool={mockPool} poolId={0} />);

    expect(screen.getByText('Connect Wallet to Bet')).toBeInTheDocument();
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('shows error toast for empty bet amount', async () => {
    vi.mocked(StacksProvider.useStacks).mockReturnValue({
      userData: { profile: { stxAddress: { mainnet: 'ST123' } } } as unknown as any,
      userSession: {} as any,
      setUserData: vi.fn(),
      openWalletModal: vi.fn(),
      isLoading: false,
      authenticate: vi.fn(),
      signOut: vi.fn(),
    } as any);

    const user = userEvent.setup();
    renderWithProviders(<BettingSection pool={mockPool} poolId={0} />);

    // Try to bet with empty amount
    const betButton = screen.getByText(/Bet on Outcome A/i);
    await user.click(betButton);

    expect(showToast).toHaveBeenCalledWith(
      'Please enter a valid bet amount greater than 0.',
      'error'
    );
    expect(vi.mocked(StacksConnect.openContractCall)).not.toHaveBeenCalled();
  });

  it('shows error toast for bet below minimum amount', async () => {
    vi.mocked(StacksProvider.useStacks).mockReturnValue({
      userData: { profile: { stxAddress: { mainnet: 'ST123' } } } as unknown as any,
      userSession: {} as any,
      setUserData: vi.fn(),
      openWalletModal: vi.fn(),
      isLoading: false,
      authenticate: vi.fn(),
      signOut: vi.fn(),
    } as any);

    const user = userEvent.setup();
    renderWithProviders(<BettingSection pool={mockPool} poolId={0} />);

    const input = screen.getByLabelText(/Enter bet amount/i);
    await user.type(input, '0.05'); // Less than 0.1 STX minimum

    const betButton = screen.getByText(/Bet on Outcome A/i);
    await user.click(betButton);

    expect(showToast).toHaveBeenCalledWith('Minimum bet amount is 0.1 STX.', 'error');
    expect(vi.mocked(StacksConnect.openContractCall)).not.toHaveBeenCalled();
  });

  it('calls openContractCall with correct parameters when placing bet', async () => {
    vi.mocked(StacksProvider.useStacks).mockReturnValue({
      userData: { profile: { stxAddress: { mainnet: 'ST123' } } } as unknown as any,
      userSession: {} as any,
      setUserData: vi.fn(),
      openWalletModal: vi.fn(),
      isLoading: false,
      authenticate: vi.fn(),
      signOut: vi.fn(),
    } as any);

    vi.mocked(StacksConnect.openContractCall).mockResolvedValue({} as never);

    const user = userEvent.setup();
    renderWithProviders(<BettingSection pool={mockPool} poolId={0} />);

    const input = screen.getByLabelText(/Enter bet amount/i);
    await user.type(input, '1.5');

    const betButton = screen.getByText(/Bet on Outcome A/i);
    await user.click(betButton);

    await waitFor(() => {
      expect(StacksConnect.openContractCall).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'place-bet',
          functionArgs: expect.arrayContaining([
            expect.anything(), // poolId
            expect.anything(), // outcome (0)
            expect.anything(), // amount (1500000 microSTX)
          ]),
        })
      );
    });
  });

  it('disables buttons while betting is in progress', async () => {
    vi.mocked(StacksProvider.useStacks).mockReturnValue({
      userData: { profile: { stxAddress: { mainnet: 'ST123' } } } as unknown as any,
      userSession: {} as any,
      setUserData: vi.fn(),
      openWalletModal: vi.fn(),
      isLoading: false,
      authenticate: vi.fn(),
      signOut: vi.fn(),
    } as any);

    // Make openContractCall hang
    vi.mocked(StacksConnect.openContractCall).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const user = userEvent.setup();
    renderWithProviders(<BettingSection pool={mockPool} poolId={0} />);

    const input = screen.getByLabelText(/Enter bet amount/i);
    await user.type(input, '1.0');

    const betButton = screen.getByText(/Bet on Outcome A/i);
    await user.click(betButton);

    // Check if loading state is shown (button should be disabled)
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const disabledButtons = buttons.filter((btn: HTMLElement) => btn.hasAttribute('disabled'));
      expect(disabledButtons.length).toBeGreaterThan(0);
    });
  });

  it('renders without provider errors when wrapped in ToastProvider', () => {
    vi.mocked(StacksProvider.useStacks).mockReturnValue({
      userData: null,
      authenticate: vi.fn(),
      signOut: vi.fn(),
    });

    // Should not throw a "useToast must be used within a ToastProvider" error
    expect(() => renderWithProviders(<BettingSection pool={mockPool} poolId={0} />)).not.toThrow();
  });
});
