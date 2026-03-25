import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareButton from '../../components/ShareButton';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure navigator.clipboard exists as a configurable own property so we can
 * spy on / replace writeText in jsdom (where clipboard is a prototype getter).
 */
function ensureClipboard() {
  if (!Object.getOwnPropertyDescriptor(navigator, 'clipboard')) {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
  }
}

function spyClipboardSuccess() {
  ensureClipboard();
  return vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
}

function spyClipboardFail() {
  ensureClipboard();
  return vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockRejectedValue(new Error('Clipboard denied'));
}

function setupNativeShare(shouldFail = false, abortError = false) {
  const share = shouldFail
    ? vi.fn().mockRejectedValue(
        abortError
          ? Object.assign(new Error('AbortError'), { name: 'AbortError' })
          : new Error('Share failed')
      )
    : vi.fn().mockResolvedValue(undefined);

  const canShare = vi.fn().mockReturnValue(true);

  Object.defineProperty(navigator, 'share', {
    value: share,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, 'canShare', {
    value: canShare,
    configurable: true,
    writable: true,
  });

  return { share, canShare };
}

function teardownNativeShare() {
  Object.defineProperty(navigator, 'share', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, 'canShare', {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShareButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    teardownNativeShare();
  });

  // --- Copy-link -----------------------------------------------------------

  it('renders the copy-link button', () => {
    spyClipboardSuccess();
    teardownNativeShare();
    render(<ShareButton url="https://example.com/markets/1" />);
    expect(screen.getByRole('button', { name: /copy market link/i })).toBeInTheDocument();
  });

  it('copies the provided URL to the clipboard on click', async () => {
    spyClipboardSuccess();
    teardownNativeShare();
    const user = userEvent.setup();

    render(<ShareButton url="https://example.com/markets/42" />);
    await user.click(screen.getByRole('button', { name: /copy market link/i }));

    // Verify the copy succeeded by checking the "Copied!" feedback state
    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument());
  });

  it('shows "Copied!" feedback after a successful copy', async () => {
    spyClipboardSuccess();
    teardownNativeShare();
    const user = userEvent.setup();

    render(<ShareButton url="https://example.com/markets/1" />);
    await user.click(screen.getByRole('button', { name: /copy market link/i }));

    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument());
  });

  it('resets copy feedback to idle after 2.5 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    spyClipboardSuccess();
    teardownNativeShare();
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    render(<ShareButton url="https://example.com/markets/1" />);
    await user.click(screen.getByRole('button', { name: /copy market link/i }));

    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument());

    act(() => vi.advanceTimersByTime(2600));
    await waitFor(() => expect(screen.getByText('Copy link')).toBeInTheDocument());
  });

  it('shows error feedback when clipboard write fails', async () => {
    spyClipboardFail();
    teardownNativeShare();
    const user = userEvent.setup();

    render(<ShareButton url="https://example.com/markets/1" />);
    await user.click(screen.getByRole('button', { name: /copy market link/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    );
  });

  // --- Native share --------------------------------------------------------

  it('renders the share button when navigator.share is available', () => {
    spyClipboardSuccess();
    setupNativeShare();
    render(<ShareButton url="https://example.com/markets/1" />);
    expect(screen.getByRole('button', { name: /share this market/i })).toBeInTheDocument();
  });

  it('does NOT render the share button when navigator.share is unavailable', () => {
    spyClipboardSuccess();
    teardownNativeShare();
    render(<ShareButton url="https://example.com/markets/1" />);
    expect(screen.queryByRole('button', { name: /share this market/i })).not.toBeInTheDocument();
  });

  it('calls navigator.share with the correct payload', async () => {
    spyClipboardSuccess();
    const { share } = setupNativeShare();
    const user = userEvent.setup();

    render(
      <ShareButton
        url="https://example.com/markets/7"
        title="Will BTC hit 100k?"
        text="Check this out"
      />
    );
    await user.click(screen.getByRole('button', { name: /share this market/i }));

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        url: 'https://example.com/markets/7',
        title: 'Will BTC hit 100k?',
        text: 'Check this out',
      })
    );
  });

  it('shows "Shared!" feedback after a successful native share', async () => {
    spyClipboardSuccess();
    setupNativeShare();
    const user = userEvent.setup();

    render(<ShareButton url="https://example.com/markets/1" />);
    await user.click(screen.getByRole('button', { name: /share this market/i }));

    await waitFor(() => expect(screen.getByText('Shared!')).toBeInTheDocument());
  });

  it('does NOT show error feedback when user dismisses the share sheet (AbortError)', async () => {
    spyClipboardSuccess();
    setupNativeShare(true, true); // abortError = true
    const user = userEvent.setup();

    render(<ShareButton url="https://example.com/markets/1" />);
    await user.click(screen.getByRole('button', { name: /share this market/i }));

    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows error feedback when native share fails with a non-abort error', async () => {
    spyClipboardSuccess();
    setupNativeShare(true, false); // real failure
    const user = userEvent.setup();

    render(<ShareButton url="https://example.com/markets/1" />);
    await user.click(screen.getByRole('button', { name: /share this market/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    );
  });
});
