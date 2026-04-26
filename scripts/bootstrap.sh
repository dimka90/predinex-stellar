#!/usr/bin/env bash
# =============================================================================
# Predinex Stellar — Bootstrap Script
#
# Sets up both web (Node.js) and contract (Rust/Soroban) development
# environments from a clean checkout. Run this script once after cloning.
#
# Usage:
#   ./scripts/bootstrap.sh
#
# What it does:
#   1. Checks that required tools are installed (Rust, Cargo, Node.js, npm).
#   2. Installs web dependencies via npm.
#   3. Verifies the Rust toolchain can compile the Soroban contract.
#   4. Runs contract tests to confirm the environment is ready.
#
# Prerequisites:
#   - Rust (https://www.rust-lang.org/tools/install)
#   - Node.js v18+ (https://nodejs.org/)
#   - npm v8+ (bundled with Node.js)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

check_command() {
    local cmd="$1"
    local install_url="$2"
    local label="${3:-$cmd}"

    if ! command -v "$cmd" &> /dev/null; then
        error "$label is not installed."
        echo "    Install it from: $install_url"
        exit 1
    fi
}

echo ""
echo "============================================"
echo "  Predinex Stellar — Environment Bootstrap"
echo "============================================"
echo ""

# ─── Check prerequisites ────────────────────────────────────────────────────

info "Checking prerequisites..."

check_command "rustc" "https://www.rust-lang.org/tools/install" "Rust (rustc)"
check_command "cargo" "https://www.rust-lang.org/tools/install" "Cargo"
check_command "node"  "https://nodejs.org/" "Node.js"
check_command "npm"   "https://nodejs.org/" "npm"

# Verify Node.js version >= 18
NODE_VERSION=$(node -v | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js v18+ is required, but found v$(node -v | sed 's/^v//')."
    echo "    Update from: https://nodejs.org/"
    exit 1
fi
info "Node.js v$(node -v | sed 's/^v//') detected."

# Verify Rust toolchain
RUSTC_VERSION=$(rustc --version | awk '{print $2}')
info "Rust $RUSTC_VERSION detected."

# Check for optional Stellar CLI
if command -v stellar &> /dev/null; then
    info "Stellar CLI detected ($(stellar version 2>/dev/null || echo 'unknown version'))."
else
    warn "Stellar CLI not found (optional, needed for deployment)."
    echo "    Install from: https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup#install-the-stellar-cli"
fi

# Check for Rust components used by CI
if rustup component list --installed 2>/dev/null | grep -q rustfmt; then
    info "rustfmt is installed."
else
    warn "rustfmt not found. Installing..."
    rustup component add rustfmt
    info "rustfmt installed."
fi

if rustup component list --installed 2>/dev/null | grep -q clippy; then
    info "clippy is installed."
else
    warn "clippy not found. Installing..."
    rustup component add clippy
    info "clippy installed."
fi

echo ""

# ─── Install web dependencies ───────────────────────────────────────────────

info "Installing web dependencies..."
cd "$REPO_ROOT/web"
npm install
info "Web dependencies installed."

echo ""

# ─── Build and test contracts ────────────────────────────────────────────────

info "Building Soroban contract..."
cd "$REPO_ROOT/contracts/predinex"
cargo build
info "Contract built successfully."

info "Running contract tests..."
cargo test
info "Contract tests passed."

echo ""

# ─── Summary ─────────────────────────────────────────────────────────────────

echo "============================================"
info "Bootstrap complete! Your environment is ready."
echo ""
echo "  Web development:"
echo "    cd web && npm run dev"
echo ""
echo "  Contract development:"
echo "    cd contracts/predinex && cargo test"
echo ""
echo "  Run CI checks locally:"
echo "    cd web && npm run lint && npm run test && npm run build"
echo "    cd contracts/predinex && cargo fmt --check && cargo clippy -- -D warnings && cargo test"
echo "============================================"
