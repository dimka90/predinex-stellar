# Predinex Frontend

Next.js 14 application providing the user interface for Predinex Prediction Markets.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Blockchain Interop**: Stellar SDK (Soroban integration)
- **Icons**: Lucide React

> [!NOTE]
> **Migration Status**: The frontend is currently transitioning from Stacks to Stellar. While core branding and documentation have been updated, some underlying legacy components are still being migrated to full Soroban support.

## UI Kit (Design System)
The project includes a custom UI kit located in `components/ui/` designed for a premium, institutional-grade experience:
- **Card**: Glassmorphism-based container for content sections.
- **Badge**: Status indicators with multiple color variants.
- **StatItem**: Specialized component for displaying dashboard metrics and trends.
- **Tabs**: Smooth navigation for switching between market views.
- **Tooltip**: Technical term explanations on hover.
- **Toast**: Ephemeral notifications for transaction feedback.

## Key Features
- **Market Discovery**: Advanced filtering, search, and sorting system on Stellar.
- **Wallet Integration**: Support for Freighter and other Stellar-compatible wallets (via WalletConnect).
- **Dashboard**: Real-time portfolio tracking and performance metrics on Soroban.
- **Transitions**: Native-like smooth page and modal animations.

## Development
See [DEVELOPMENT.md](./DEVELOPMENT.md) for setup and architectural guidelines.
