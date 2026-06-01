# Route-Level Code Chunking

This document records the lazy-loading decisions made for the dashboard and disputes routes (issue #238).

## Strategy

We use `next/dynamic` to split heavy or conditionally-rendered feature sections into separate JS chunks. The rule of thumb:

- **Eager**: navigation chrome (`Navbar`), auth guards, data-fetching hooks, components visible in the initial viewport.
- **Lazy**: components below the fold, tab-gated panels (only rendered on user interaction), and entire feature bundles behind a route.

Lazy components receive a lightweight `loading` skeleton that matches the component's approximate size to avoid layout shift while the chunk downloads.

## Dashboard route (`/dashboard`)

File: `app/dashboard/page.tsx`

| Component | Strategy | Reason |
|---|---|---|
| `Navbar` | Eager | Navigation chrome, critical for first render |
| `AuthGuard` | Eager | Gate for the entire page content |
| `PlatformStats` | **Lazy** | Below the heading; fetches its own async data |
| `PortfolioOverview` | **Lazy** | Wallet-conditional; secondary to the page heading |
| `ActiveBetsCard` | **Lazy** | Below the fold in a two-column grid |
| `ActivityFeed` | **Lazy** | Below the fold in a two-column grid |

File: `app/components/Dashboard.tsx`

| Component | Strategy | Reason |
|---|---|---|
| `DashboardHeader` | Eager | Always visible |
| `DashboardStatsSections` | Eager | Always visible |
| `DashboardTabBar` | Eager | Always visible |
| `DashboardOverviewPanel` | Eager | Renders on the default (`overview`) tab |
| `DashboardActiveBetsPanel` | **Lazy** | Only renders when the `bets` tab is active |
| `DashboardHistoryPanel` | **Lazy** | Only renders when the `history` tab is active |
| `IncentivesDisplay` | **Lazy** | Only renders when the `incentives` tab is active; heaviest panel (external API calls) |

## Disputes route (`/disputes`)

File: `app/disputes/page.tsx`

| Component | Strategy | Reason |
|---|---|---|
| `Navbar` | Eager | Navigation chrome |
| `DisputeManagement` | **Lazy** | Entire feature bundle; not needed until the user navigates to `/disputes` |

File: `app/components/DisputeManagement.tsx`

| Component | Strategy | Reason |
|---|---|---|
| `DisputePageHeader` | Eager | Visible on initial tab |
| `DisputeTabNav` | Eager | Visible on initial tab |
| `ActiveDisputesSection` | Eager | Default tab content |
| `ResolvedDisputesSection` | **Lazy** | Only renders when the `resolved` tab is active |
| `CreateDisputeSection` | **Lazy** | Only renders when the `create` tab is active |

## Loading states

Each lazy component ships with a matching skeleton shown while the chunk downloads. Components that have their own internal loading states (e.g. `PlatformStats`, `ActivityFeed`) will transition seamlessly from the Suspense skeleton to their own skeleton once the JS executes and data fetching begins.

## Verifying the split

```bash
cd web
npm run build
# Check .next/static/chunks/ — route-specific chunks should appear for
# DisputeManagement, IncentivesDisplay, and the dashboard feature panels.
```
