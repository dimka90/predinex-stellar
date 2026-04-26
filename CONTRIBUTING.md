# Contributing to Predinex Stellar

<!-- #241 — single contributor guide covering local setup, testing, and issue workflow. -->

Thank you for contributing! This guide covers everything you need to go from a
fresh clone to a merged pull request.

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Local setup](#local-setup)
3. [Running the web app](#running-the-web-app)
4. [Running contract checks](#running-contract-checks)
5. [Testing](#testing)
6. [Code standards](#code-standards)
7. [Issue workflow](#issue-workflow)
8. [Pull request process](#pull-request-process)
9. [Feature flags](#feature-flags)

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 22 |
| npm | 10 |
| Rust | stable (latest) |
| Stellar CLI | latest |

Install Rust and the WASM target:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli
```

---

## Local setup

```bash
# 1. Fork the repo, then clone your fork.
git clone https://github.com/<your-handle>/predinex-stellar.git
cd predinex-stellar

# 2. Add the upstream remote so you can pull future changes.
git remote add upstream https://github.com/dimka90/predinex-stellar.git

# 3. Install web dependencies.
cd web && npm ci
```

Copy the environment template and fill in your values:

```bash
cp web/.env.example web/.env.local
```

Key variables (see `.env.example` for the full list):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_NETWORK` | `testnet` or `mainnet` |
| `NEXT_PUBLIC_SOROBAN_CONTRACT_ID` | Deployed contract address |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | From WalletConnect Cloud |

---

## Running the web app

```bash
cd web
npm run dev        # start on http://localhost:3000
npm run build      # production build (catches type errors)
npm run lint       # ESLint
```

---

## Running contract checks

```bash
cd contracts/predinex
cargo fmt --check  # formatting
cargo clippy -- -D warnings  # lints
cargo test         # unit tests
```

CI runs all three. Make sure they pass locally before opening a PR.

---

## Testing

```bash
# web — unit and integration tests (Vitest)
cd web
npm run test -- --run       # run once
npm run test                # watch mode
npm run test:coverage       # coverage report

# web — browser tests
npm run test:ui
```

Tests live next to the code they cover (`*.test.ts` / `*.test.tsx`). New
features should include at minimum a happy-path test; contract integrations
should cover error and rejection paths too.

---

## Code standards

- **TypeScript**: strict mode, no `any` without a comment explaining why.
- **React**: server components by default; add `'use client'` only when needed.
- **Imports**: use the `@/` path alias for `web/` internals.
- **Formatting**: Prettier via ESLint — run `npm run lint` to check.
- **Commits**: conventional commits preferred (`feat:`, `fix:`, `docs:`, etc.).
- **Comments**: explain *why*, not *what*. One line max unless the invariant
  is genuinely subtle.

---

## Issue workflow

1. **Find or create an issue** before starting work. Comment to claim it so
   effort is not duplicated.
2. **Branch off `main`** — always from the latest upstream `main`:
   ```bash
   git fetch upstream && git checkout -b feat/<short-description> upstream/main
   ```
3. **Keep PRs focused** — one issue (or a tightly related group) per PR.
4. **Stale policy**: issues and PRs with no activity for 30 days will be
   labelled `stale` and closed after a further 7 days. Remove the label or
   comment to keep an item open.

### Labels

| Label | Meaning |
|-------|---------|
| `contract` | Changes in `contracts/` |
| `web` | Changes in `web/` |
| `docs` | Documentation changes |
| `ci` | Workflow / tooling changes |
| `stale` | Inactive for 30 days |
| `in-progress` | Actively being worked on — exempt from stale policy |
| `pinned` | Never closed by the stale bot |

---

## Pull request process

1. Open a PR against `main` using the provided PR template.
2. Fill in all checklist items — incomplete sections slow review.
3. CI must pass (lint, tests, build for web; fmt, clippy, test for contracts).
4. At least one maintainer review is required before merge.
5. Link every resolved issue with `Closes #N` in the PR body.

---

## Feature flags

Some in-development features are hidden behind `NEXT_PUBLIC_*` flags:

| Flag | Default | Purpose |
|------|---------|---------|
| `NEXT_PUBLIC_ENABLE_MOCK_DISPUTES` | `false` | Load mock dispute fixtures (local dev) |
| `NEXT_PUBLIC_ENABLE_MOCK_ORACLE` | `false` | Load mock oracle fixtures (local dev) |
| `NEXT_PUBLIC_ENABLE_MOCK_POOLS` | `false` | Load mock pool fixtures (local dev) |
| `NEXT_PUBLIC_ERROR_REPORTING` | `false` | Enable structured error reporting |

Set these in `web/.env.local` — never commit real values.
