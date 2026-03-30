# Development Guide - Predinex Frontend

This document provides instructions for developers looking to contribute to the Predinex frontend. For information on the release lifecycle, see the [Release Process](../RELEASE.md).

## Prerequisites

- **Node.js**: v18 or higher
- **npm**: v8 or higher (npm is the standard package manager for this project)
- **Wallet**: [Freighter](https://www.freighter.app/) (for testing Stellar interactions)

> **Note**: This project uses `npm` as the sole package manager. Please do not use `pnpm` or `yarn` to avoid lockfile conflicts.

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env.local` file in the `web` directory:
   ```env
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_NETWORK=testnet
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to see the result.

## Project Structure

- `web/app/`: Next.js App Router (pages and layouts)
- `web/components/`: Reusable UI components
- `web/app/lib/`: Core logic, hooks, and utility functions
- `web/components/ui/`: Shared primitive components (design system)

## Coding Standards

### TypeScript
- Use functional components with Proper TypeScript interfaces.
- Avoid using `any` type; define proper interfaces for all data.

### Styling
- Use **Tailwind CSS** for all styling.
- Follow the design system defined in `web/app/globals.css`.
- Use the `Card` and `Badge` components for consistent layout and status display.

### Icons
- Use **Lucide React** for icons.
- Import standard sizes/classes from `web/app/lib/constants.ts` (`ICON_CLASS`).

### Documentation
- Use JSDoc for all utility functions and complex components.
- Keep components small and focused.

## Component Library

We use a custom component library located in `web/components/ui/`. Key components include:
- `Card`: Standard glassmorphism container.
- `Badge`: Status and tag indicator.
- `StatusBadge`: Specialized market status badge.
- `Tooltip`: Informational overlays.
- `Toast`: Session notifications.

## Contract Integration

When working on features that touch the smart contract interface:

- **Event schemas** — Refer to [docs/CONTRACT_EVENTS.md](./docs/CONTRACT_EVENTS.md) for the canonical event payload definitions. Do not reverse-engineer event structures from the contract source.
- **Versioning & migrations** — All contract changes (breaking or otherwise) must follow the process in [docs/CONTRACT_VERSIONING.md](./docs/CONTRACT_VERSIONING.md). Breaking interface changes require an explicit major version bump and a migration note before the PR can be merged.
- **Error boundaries** — Route-level components should be wrapped in `<RouteErrorBoundary routeName="...">` (see `web/components/RouteErrorBoundary.tsx`). Add the wrapper when creating new top-level pages.

## Testing

### Local CI/CD Checks

Before pushing, ensure all checks pass:

```bash
npm run lint
npm run test
npm run build
```
