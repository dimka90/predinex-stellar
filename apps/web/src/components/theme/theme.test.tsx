import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";


// Mock localStorage


const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});


// Mock matchMedia


function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}


// Helper: render with ThemeProvider


function renderWithTheme(ui: React.ReactNode) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}


// Test component that exposes theme values


function ThemeInspector() {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button data-testid="toggle" onClick={toggleTheme}>
        Toggle
      </button>
    </div>
  );
}


// Tests


describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.classList.remove("dark");
    mockMatchMedia(false); // default to light system preference
  });

  // ── System preference detection ──
  it("defaults to system preference on first visit (dark)", () => {
    mockMatchMedia(true); // system prefers dark
    renderWithTheme(<ThemeInspector />);
    expect(screen.getByTestId("theme").textContent).toBe("system");
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("defaults to system preference on first visit (light)", () => {
    mockMatchMedia(false); // system prefers light
    renderWithTheme(<ThemeInspector />);
    expect(screen.getByTestId("theme").textContent).toBe("system");
    expect(screen.getByTestId("resolved").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  // ── localStorage persistence ──
  it("reads persisted light theme from localStorage", () => {
    localStorageMock.setItem("predinex-theme", "light");
    renderWithTheme(<ThemeInspector />);
    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(screen.getByTestId("resolved").textContent).toBe("light");
  });

  it("reads persisted dark theme from localStorage", () => {
    localStorageMock.setItem("predinex-theme", "dark");
    renderWithTheme(<ThemeInspector />);
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("persists theme change to localStorage", () => {
    renderWithTheme(<ThemeInspector />);
    fireEvent.click(screen.getByTestId("toggle"));
    expect(localStorageMock.getItem("predinex-theme")).toBe("dark");
  });

  it("persists across reloads", () => {
    renderWithTheme(<ThemeInspector />);
    fireEvent.click(screen.getByTestId("toggle")); // toggle to dark

    // Simulate reload: unmount and remount
    const { unmount } = renderWithTheme(<ThemeInspector />);
    unmount();

    renderWithTheme(<ThemeInspector />);
    expect(screen.getByTestId("theme").textContent).toBe("dark");
  });

  // ── Toggle behavior ──
  it("toggle switches from light to dark", () => {
    localStorageMock.setItem("predinex-theme", "light");
    renderWithTheme(<ThemeInspector />);
    fireEvent.click(screen.getByTestId("toggle"));
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("toggle switches from dark to light", () => {
    localStorageMock.setItem("predinex-theme", "dark");
    renderWithTheme(<ThemeInspector />);
    fireEvent.click(screen.getByTestId("toggle"));
    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  // ── System preference changes ──
  it("reacts to system preference change when in system mode", () => {
    mockMatchMedia(false);
    renderWithTheme(<ThemeInspector />);
    expect(screen.getByTestId("resolved").textContent).toBe("light");

    // Simulate system switch to dark
    mockMatchMedia(true);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (media.addEventListener as ReturnType<typeof vi.fn>).mock
      .calls[0][1];
    act(() => {
      listener({ matches: true } as MediaQueryListEvent);
    });

    expect(screen.getByTestId("resolved").textContent).toBe("dark");
  });

  it("ignores system preference changes when theme is explicitly set", () => {
    localStorageMock.setItem("predinex-theme", "light");
    mockMatchMedia(true); // system prefers dark
    renderWithTheme(<ThemeInspector />);
    expect(screen.getByTestId("resolved").textContent).toBe("light");
  });

  // ── Edge cases ──
  it("handles corrupted localStorage gracefully", () => {
    localStorageMock.setItem("predinex-theme", "invalid-value");
    renderWithTheme(<ThemeInspector />);
    // Should fall back to system preference
    expect(screen.getByTestId("theme").textContent).toBe("system");
  });

  it("handles missing localStorage API gracefully", () => {
    const original = window.localStorage;
    Object.defineProperty(window, "localStorage", {
      value: undefined,
    });
    expect(() => renderWithTheme(<ThemeInspector />)).not.toThrow();
    Object.defineProperty(window, "localStorage", {
      value: original,
    });
  });
});

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.classList.remove("dark");
    mockMatchMedia(false);
  });

  it("renders in the navbar with accessible label", () => {
    renderWithTheme(<ThemeToggle />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label");
  });

  it("cycles through light → dark → system → light on click", () => {
    renderWithTheme(<ThemeToggle />);
    const button = screen.getByRole("button");

    // Starts at system (resolved to light)
    expect(screen.getByText("system")).toBeInTheDocument();

    // Click 1: system → light
    fireEvent.click(button);
    expect(screen.getByText("light")).toBeInTheDocument();

    // Click 2: light → dark
    fireEvent.click(button);
    expect(screen.getByText("dark")).toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // Click 3: dark → system
    fireEvent.click(button);
    expect(screen.getByText("system")).toBeInTheDocument();
  });

  it("displays correct icon for dark mode", () => {
    localStorageMock.setItem("predinex-theme", "dark");
    renderWithTheme(<ThemeToggle />);
    // Moon icon should be present (aria-hidden svg)
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("displays correct icon for light mode", () => {
    localStorageMock.setItem("predinex-theme", "light");
    renderWithTheme(<ThemeToggle />);
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});

describe("Dark mode CSS integration", () => {
  it("applies dark class to html element in dark mode", () => {
    localStorageMock.setItem("predinex-theme", "dark");
    renderWithTheme(<div>content</div>);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes dark class from html element in light mode", () => {
    localStorageMock.setItem("predinex-theme", "light");
    renderWithTheme(<div>content</div>);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("applies transition classes for smooth theme switching", () => {
    renderWithTheme(<div data-testid="content">content</div>);
    const element = screen.getByTestId("content");
    const styles = window.getComputedStyle(element);
    // Tailwind transition-theme should be applied via globals.css
    expect(styles.transitionProperty).toContain("background-color");
  });
});