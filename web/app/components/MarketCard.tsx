'use client';

import Link from 'next/link';
import { Clock, TrendingUp, Users, CheckCircle, XCircle, Star, StarOff } from 'lucide-react';
import { ProcessedMarket } from '../lib/market-types';
import { formatSTXAmount, formatTimeRemaining } from '../lib/market-utils';
import { formatDisplayAddress } from '../lib/address-display';
import { usePoolFavorites } from '../lib/hooks/usePoolFavorites';

interface MarketCardProps {
  market: ProcessedMarket;
}

export default function MarketCard({ market }: MarketCardProps) {
  const { isFavorite, toggleFavorite } = usePoolFavorites();
  const favorite = isFavorite(market.poolId);

  const getStatusColor = (status: ProcessedMarket['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500';
      case 'settled':
        return 'bg-blue-500/10 text-blue-500';
      case 'expired':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getStatusIcon = (status: ProcessedMarket['status']) => {
    switch (status) {
      case 'active':
        return <Clock className="w-3 h-3" />;
      case 'settled':
        return <CheckCircle className="w-3 h-3" />;
      case 'expired':
        return <XCircle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: ProcessedMarket['status']) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'settled':
        return 'Settled';
      case 'expired':
        return 'Expired';
      default:
        return 'Unknown';
    }
  };

  const getTimeDisplay = () => {
    if (market.status === 'settled') {
      return 'Settled';
    } else if (market.status === 'expired') {
      return 'Expired';
    } else if (market.timeRemaining !== null) {
      return formatTimeRemaining(market.timeRemaining);
    } else {
      return 'Expired';
    }
  };

  return (
    <Link href={`/markets/${market.poolId}`}>
      <div className="glass p-6 rounded-xl hover:border-primary/50 transition-all duration-200 cursor-pointer group h-full flex flex-col justify-between hover:shadow-lg hover:shadow-primary/10">
        {/* Header */}
        <div>
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-mono text-muted-foreground">
              #POOL-{market.poolId}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${getStatusColor(market.status)}`}
              >
                {getStatusIcon(market.status)}
                {getStatusText(market.status)}
              </span>

              <button
                type="button"
                aria-label={favorite ? `Unfavorite pool #${market.poolId}` : `Favorite pool #${market.poolId}`}
                title={favorite ? 'Remove bookmark' : 'Bookmark pool'}
                onClick={(e) => {
                  // Prevent the surrounding Link from navigating when toggling favorites.
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFavorite(market.poolId);
                }}
                className={`p-2 rounded-lg border transition-colors ${
                  favorite
                    ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/15'
                    : 'bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {favorite ? (
                  <Star className="w-4 h-4" fill="currentColor" strokeWidth={2} />
                ) : (
                  <StarOff className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Title and Description */}
          <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {market.title}
          </h3>
          <p className="text-sm text-muted-foreground mb-6 line-clamp-3">
            {market.description}
          </p>
        </div>

        {/* Market Info */}
        <div className="space-y-4">
          {/* Outcomes */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="font-medium text-green-400">{market.outcomeA}</span>
                <span className="text-xs text-muted-foreground">({market.oddsA}%)</span>
              </div>
              <span className="text-muted-foreground text-xs">vs</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">({market.oddsB}%)</span>
                <span className="font-medium text-red-400">{market.outcomeB}</span>
              </div>
            </div>

            {/* Odds visualization bar */}
            <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
              <div className="h-full flex">
                <div 
                  className="bg-green-400 transition-all duration-300"
                  style={{ width: `${market.oddsA}%` }}
                />
                <div 
                  className="bg-red-400 transition-all duration-300"
                  style={{ width: `${market.oddsB}%` }}
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span>{formatSTXAmount(market.totalVolume)}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{getTimeDisplay()}</span>
            </div>
          </div>

          {/* Creator info */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t border-muted/20">
            <Users className="w-3 h-3" />
            <span>Created by {formatDisplayAddress(market.creator)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}