# Release Process

This document outlines the release checklist and version tagging process for Predinex Stellar.

## 📋 Release Checklist

Before tagging a new release, ensure the following steps are completed:

### 1. Verification
- [ ] **Web Build**: Run `npm run build` in the `web` directory.
- [ ] **Contract Tests**: Run `cargo test` in `contracts/predinex`.
- [ ] **Linting**: Ensure `npm run lint` and `cargo fmt --check` / `cargo clippy` pass.
- [ ] **Environment**: Verify `.env.production` (if applicable) and contract IDs are correct for the target network.

### 2. Documentation
- [ ] **Version Bump**: Update version in `web/package.json` and `contracts/predinex/Cargo.toml`.
- [ ] **Changelog**: Update `CHANGELOG.md` with new features, fixes, and breaking changes.
- [ ] **README**: Ensure all setup instructions and architecture diagrams are up to date.

### 3. Tagging & Branching
- [ ] **Main Sync**: Ensure your local `main` branch is up to date with the remote.
- [ ] **Merge**: All features for the release should be merged into `main`.
- [ ] **Tag**: Create a new version tag (see [Version Tagging](#-version-tagging)).

---

## 🏷 Version Tagging

We follow [Semantic Versioning](https://semver.org/) (`vMAJOR.MINOR.PATCH`).

### Automated Tagging (GitHub Actions)
You can trigger the **Tag Release** workflow manually from the GitHub Actions tab:
1. Navigate to **Actions** > **Tag Release**.
2. Click **Run workflow**.
3. Enter the new version number (e.g., `v1.2.3`).
4. Click **Run workflow**.

### Manual Tagging
If you prefer to tag manually:
```bash
# Create the tag
git tag -a v1.2.3 -m "Release v1.2.3"

# Push the tag to origin
git push origin v1.2.3
```

---

## 📝 Changelog Categories

Changes are grouped by delivery area so each stakeholder can find relevant updates quickly.
Add a new entry to `CHANGELOG.md` using the following format:

```markdown
## [v1.2.3] - 2026-03-25

### ⛓ Contract
- Changes to Clarity contracts in `contracts/`.

### 🌐 Web
- Changes to the Next.js frontend in `web/`.

### 📖 Docs
- README, RELEASE, architectural docs, inline documentation.

### ⚙️ Ops & CI
- GitHub Actions workflows, `scripts/`, tooling, dependency updates.
```

### Label → Category mapping

Every PR should carry one `area:` label. GitHub's automatic release notes
(`releases/new` → *Generate release notes*) use `.github/release.yml` to
sort merged PRs into the same four categories automatically.

| Label | Changelog section | Covers |
|---|---|---|
| `area: contract` | ⛓ Contract | `contracts/` — Clarity source, tests, deployment scripts |
| `area: web` | 🌐 Web | `web/` — Next.js pages, components, hooks, styles |
| `area: docs` | 📖 Docs | `*.md` files, `web/docs/`, inline code comments |
| `area: ops` | ⚙️ Ops & CI | `.github/`, `scripts/`, tooling, dependency bumps |

Cross-area PRs should carry the label for the *primary* change area.
The `bug` and `enhancement` labels can be added alongside an `area:` label
for finer-grained filtering.
