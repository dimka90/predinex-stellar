'use client';

import { useMemo } from 'react';
import Navbar from "../components/Navbar";
import { StatsCard } from '@/components/ui/StatsCard';
import SearchBar from "../components/SearchBar";
import FilterControls from "../components/FilterControls";
import SortControls from "../components/SortControls";
import MarketGrid from "../components/MarketGrid";
import Pagination from "../components/Pagination";
import { useMarketDiscovery } from "../lib/hooks/useMarketDiscovery";
import RouteErrorBoundary from "../../components/RouteErrorBoundary";

function MarketsContent() {
  const {
    paginatedMarkets,
    isLoading,
    error,
    blockHeightWarning,
    filters,
    pagination,
    setSearch,
    setStatusFilter,
    setSortBy,
    setPage,
    retry,
    filteredMarkets
  } = useMarketDiscovery();

  // Calculate filter counts for display
  const filterCounts = useMemo(() => {
    const counts = {
      all: filteredMarkets.length,
      active: 0,
      settled: 0,
      expired: 0
    };

    filteredMarkets.forEach(market => {
      counts[market.status]++;
    });

    return counts;
  }, [filteredMarkets]);

  const hasActiveFilters = filters.search.trim() !== '' || filters.status !== 'all';

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="pt-32 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Prediction Markets</h1>
          <p className="text-muted-foreground">
            Discover and participate in decentralized prediction markets on Stellar
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatsCard title="Total Markets" value={filterCounts.all} />
          <StatsCard title="Active" value={filterCounts.active} />
          <StatsCard title="Settled" value={filterCounts.settled} />
        </div>

        {/* Controls */}
        <div className="space-y-6 mb-8 sticky top-16 z-30 py-4 bg-background/80 backdrop-blur-md border-b border-transparent md:border-border/10">
          {/* Search */}
          <div className="max-w-2xl">
            <SearchBar
              value={filters.search}
              onChange={setSearch}
              placeholder="Search markets by title or description..."
            />
          </div>

          {/* Filters and Sort */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Status Filters */}
            <div className="flex-1">
              <FilterControls
                selectedStatus={filters.status}
                onStatusChange={setStatusFilter}
                counts={filterCounts}
              />
            </div>

            {/* Sort Controls */}
            <div className="lg:w-64">
              <SortControls
                selectedSort={filters.sortBy}
                onSortChange={setSortBy}
              />
            </div>
          </div>
        </div>

        {/* Non-blocking freshness warning */}
        {blockHeightWarning && (
          <div
            className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200"
            role="status"
            aria-live="polite"
          >
            {blockHeightWarning}
          </div>
        )}

        {/* Markets Grid */}
        <MarketGrid
          markets={paginatedMarkets}
          isLoading={isLoading}
          error={error}
          onRetry={retry}
          searchQuery={filters.search}
          hasFilters={hasActiveFilters}
        />

        {/* Pagination */}
        {!isLoading && !error && paginatedMarkets.length > 0 && (
          <Pagination
            pagination={pagination}
            onPageChange={setPage}
          />
        )}
      </div>
    </main>
  );
}

export default function MarketsPage() {
  return (
    <RouteErrorBoundary routeName="Markets">
      <MarketsContent />
    </RouteErrorBoundary>
  );
}
