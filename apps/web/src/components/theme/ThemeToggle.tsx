"use client";

import { useTheme } from "./ThemeProvider";

/**
 * ThemeToggle — renders a button in the navbar that cycles through
 * light / dark / system themes. Displays the current resolved theme
 * with an icon and label for accessibility.
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const nextTheme =
    theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

  const icon =
    resolvedTheme === "dark" ? (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    ) : (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
    );

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:ring-slate-500"
      aria-label={`Current theme: ${resolvedTheme}. Click to switch to ${nextTheme}.`}
      title={`Theme: ${theme} (resolved: ${resolvedTheme}) — click for ${nextTheme}`}
    >
      {icon}
      <span className="hidden sm:inline capitalize">{theme}</span>
    </button>
  );
}