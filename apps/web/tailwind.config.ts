import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class", // Enable class-based dark mode (required for manual toggle)
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic color tokens for both themes
        surface: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          elevated: "rgb(var(--color-surface-elevated) / <alpha-value>)",
        },
        foreground: {
          DEFAULT: "rgb(var(--color-foreground) / <alpha-value>)",
          muted: "rgb(var(--color-foreground-muted) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--color-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--color-primary) / <alpha-value>)",
          foreground: "rgb(var(--color-primary-foreground) / <alpha-value>)",
        },
      },
      transitionProperty: {
        theme: "background-color, border-color, color, fill, stroke",
      },
      transitionDuration: {
        theme: "300ms",
      },
    },
  },
  plugins: [],
};

export default config;