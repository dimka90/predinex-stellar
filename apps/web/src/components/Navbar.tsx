"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Navbar — site navigation with integrated theme toggle.
 * Renders correctly in both light and dark themes.
 */
export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo / Brand */}
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-foreground transition-colors hover:text-primary"
        >
          Predinex
        </Link>

        {/* Navigation links */}
        <div className="hidden items-center gap-6 sm:flex">
          <NavLink href="/markets">Markets</NavLink>
          <NavLink href="/portfolio">Portfolio</NavLink>
          <NavLink href="/leaderboard">Leaderboard</NavLink>
        </div>

        {/* Right side: theme toggle + wallet connect placeholder */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button className="button-primary hidden sm:inline-flex">
            Connect Wallet
          </button>
        </div>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
    >
      {children}
    </Link>
  );
}