import { Pool } from '@/app/lib/stacks-api';
import MarketCard from './MarketCard';
import { Spinner } from './ui/spinner';
import { Search } from 'lucide-react';

interface Props {
    markets: Pool[];
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
    searchQuery?: string;
    hasFilters?: boolean;
}

export default function MarketGrid({ markets, isLoading, error, onRetry, hasFilters }: Props) {
    if (isLoading) {
        return (
            <div className="flex justify-center py-20">
                <Spinner className="h-8 w-8" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-20 bg-red-500/5 rounded-3xl border border-red-500/10">
                <p className="text-red-500 mb-4 font-medium">{error}</p>
                <button
                    onClick={onRetry}
                    className="px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors border border-red-500/20"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (markets.length === 0) {
        return (
            <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border animate-in fade-in zoom-in-95 duration-500">
                <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">No markets found</h3>
                <p className="text-muted-foreground max-w-sm mx-auto px-4">
                    {hasFilters
                        ? "We couldn't find any markets matching your current search or filters. Try adjusting them and search again."
                        : "There are no prediction markets available at the moment. Check back later!"}
                </p>
                {hasFilters && (
                    <button
                        onClick={onRetry}
                        className="mt-8 px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-colors border border-primary/20"
                    >
                        Reset All Filters
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map(market => (
                <MarketCard key={market.id} market={market} />
            ))}
        </div>
    );
}
