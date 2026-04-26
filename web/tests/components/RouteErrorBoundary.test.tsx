import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouteErrorBoundary } from '../../components/RouteErrorBoundary';

// Suppress console.error noise from intentional throws in these tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Helper: a child component that throws synchronously on demand.
 */
function BombChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test explosion');
  return <div>Safe content</div>;
}

describe('RouteErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <RouteErrorBoundary routeName="Test">
        <div>All good</div>
      </RouteErrorBoundary>
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the default fallback when a child throws', () => {
    render(
      <RouteErrorBoundary routeName="Markets">
        <BombChild shouldThrow />
      </RouteErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/the markets page/i)).toBeInTheDocument();
  });

  it('shows the error message in the details section', () => {
    render(
      <RouteErrorBoundary>
        <BombChild shouldThrow />
      </RouteErrorBoundary>
    );

    expect(screen.getByText(/Test explosion/)).toBeInTheDocument();
  });

  it('renders a "Try Again" button that resets the boundary', async () => {
    const user = userEvent.setup();

    // Use a controllable wrapper so we can stop throwing before reset
    let throwOnRender = true;
    function ControllableBomb() {
      if (throwOnRender) throw new Error('Test explosion');
      return <div>Safe content</div>;
    }

    const { rerender } = render(
      <RouteErrorBoundary routeName="Test">
        <ControllableBomb />
      </RouteErrorBoundary>
    );

    // Error state is shown
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Stop throwing so the next render succeeds, then reset the boundary
    throwOnRender = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));

    // Force a re-render so React picks up the cleared error state
    rerender(
      <RouteErrorBoundary routeName="Test">
        <ControllableBomb />
      </RouteErrorBoundary>
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('renders a "Go Home" link pointing to the root', () => {
    render(
      <RouteErrorBoundary>
        <BombChild shouldThrow />
      </RouteErrorBoundary>
    );

    const homeLink = screen.getByRole('link', { name: /go home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('renders a custom fallback when the fallback prop is provided', () => {
    render(
      <RouteErrorBoundary
        fallback={({ error, reset }) => (
          <div data-testid="custom-fallback">
            <p>Custom error: {error.message}</p>
            <button onClick={reset}>Recover</button>
          </div>
        )}
      >
        <BombChild shouldThrow />
      </RouteErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText(/custom error: test explosion/i)).toBeInTheDocument();
  });

  it('does not render "the X page" text when routeName is omitted', () => {
    render(
      <RouteErrorBoundary>
        <BombChild shouldThrow />
      </RouteErrorBoundary>
    );

    // Without routeName, the copy should still be rendered
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    // and it falls back to generic "this page"
    expect(screen.getByText(/this page/i)).toBeInTheDocument();
  });
});
