'use client';

import { memo } from 'react';
import { Trophy, RefreshCw, AlertCircle } from 'lucide-react';
import { useLeaderboard } from '../app/lib/hooks/useLeaderboard';
import { formatDisplayAddress } from '../app/lib/address-display';

interface LeaderboardProps {
  currentUserAddress?: string | null;
}

const RANK_COLORS: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-slate-300',
  3: 'text-amber-600',
};

const Leaderboard = memo(function Leaderboard({ currentUserAddress }: LeaderboardProps) {
  const { entries, isLoading, error, refresh } = useLeaderboard(currentUserAddress);

  return (
    <div className="glass-panel rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-yellow-500" />
          <h2 className="text-2xl font-bold">Top Contributors</h2>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
          aria-label="Refresh leaderboard"
        >
          <RefreshCw className={`h-4 w-4 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Ranking formula explanation */}
      <p className="text-xs text-muted-foreground mb-4">
        Ranked by total net profits (winnings - wagered).
      </p>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {isLoading && entries.length === 0 ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg animate-pulse">
              <div className="flex items-center gap-4">
                <div className="h-5 w-8 bg-muted/50 rounded" />
                <div className="h-10 w-10 rounded-full bg-muted/50" />
                <div className="h-4 w-32 bg-muted/50 rounded" />
              </div>
              <div className="h-4 w-20 bg-muted/50 rounded" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No contributors yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.slice(0, 10).map((entry) => {
            const isCurrentUser = currentUserAddress && entry.address === currentUserAddress;
            const rankColor = RANK_COLORS[entry.rank] ?? 'text-muted-foreground';
            const profitsDisplay = entry.totalProfits >= 1_000_000
              ? `${(entry.totalProfits / 1_000_000).toFixed(2)} STX`
              : `${entry.totalProfits.toLocaleString()} μSTX`;

            return (
              <div
                key={entry.address}
                className={`flex items-center justify-between p-4 rounded-lg transition-colors
                  ${isCurrentUser
                    ? 'bg-primary/10 border border-primary/30'
                    : 'bg-muted/30 hover:bg-muted/50'
                  }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`font-bold text-lg font-mono w-8 ${rankColor}`}>
                    #{entry.rank}
                  </span>
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {entry.address.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-medium text-sm">
                      {formatDisplayAddress(entry.address)}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-primary font-semibold">(you)</span>
                      )}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {entry.totalPredictions} predictions • {entry.winPercentage.toFixed(1)}% win rate
                      {entry.currentStreak > 0 && (
                        <span className="ml-2 text-green-400">• {entry.currentStreak}🔥</span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="font-bold text-primary text-sm">{profitsDisplay}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default Leaderboard;
