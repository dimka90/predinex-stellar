# Changelog

All notable changes to Predinex Stellar are documented here.
Entries are grouped by delivery area so each stakeholder can scan the section relevant to them.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### ⛓ Contract
<!-- Changes to Clarity contracts in contracts/ -->

### 🌐 Web
<!-- Changes to the Next.js frontend in web/ -->

### 📖 Docs
<!-- README, RELEASE, architectural docs, inline documentation -->

### ⚙️ Ops & CI
<!-- GitHub Actions workflows, scripts/, tooling, dependency updates -->

---

## [v0.1.0] - 2026-04-25

### ⛓ Contract
- Initial Clarity prediction-market contract with pool creation, betting, and settlement logic.

### 🌐 Web
- Next.js frontend with wallet connection (Stacks/WalletConnect), market browsing, and dashboard.
- Dispute resolution UI with community voting.
- Lazy-loaded route bundles for `/dashboard` and `/disputes` to reduce initial JS weight.

### 📖 Docs
- `RELEASE.md` release checklist and version-tagging guide.
- `web/docs/` — AppKit integration, contract events, contract versioning, market-list caching, route chunking.

### ⚙️ Ops & CI
- GitHub Actions: `ci.yml` (build + lint), `security-audit.yml`, `tag-release.yml`.
- Dependency caching strategy documented in `web/DEVELOPMENT.md`.
