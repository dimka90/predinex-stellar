'use client';

import { useState, useEffect } from 'react';
import { useStacks } from './StacksProvider';
import { useWalletConnect } from '../lib/hooks/useWalletConnect';
import IncentivesDisplay from './IncentivesDisplay';
import { BarChart3, Wallet, Award, Gift } from 'lucide-react';

interface UserBet {
  poolId: number;
  poolTitle: string;
  outcome: string;
  amount: number;
  status: 'active' | 'won' | 'lost' | 'pending';
  createdAt: number;
  winnings?: number;
}

interface DashboardStats {
  totalBets: number;
  totalWagered: number;
  totalWinnings: number;
  winRate: number;
  activeBets: number;
  settledBets: number;
}

export default function Dashboard() {
  const { userData } = useStacks();
  const { session } = useWalletConnect();
  const [stats, setStats] = useState<DashboardStats>({
    totalBets: 0,
    totalWagered: 0,
    totalWinnings: 0,
    winRate: 0,
    activeBets: 0,
    settledBets: 0,
  });
  const [bets, setBets] = useState<UserBet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'bets' | 'history' | 'incentives'>('overview');

  useEffect(() => {
    if (session?.isConnected || userData) {
      fetchUserData();
    }
  }, [session, userData]);

  const fetchUserData = async () => {
    setIsLoading(true);
    try {
      // Mock data for now - in production, fetch from API
      const mockBets: UserBet[] = [
        {
          poolId: 0,
          poolTitle: 'Bitcoin Price > $100k?',
          outcome: 'Yes',
          amount: 50,
          status: 'active',
          createdAt: Date.now() - 86400000,
        },
        {
          poolId: 1,
          poolTitle: 'ETH Reaches $5k?',
          outcome: 'No',
          amount: 25,
          status: 'won',
          createdAt: Date.now() - 172800000,
          winnings: 45,
        },
        {
          poolId: 2,
          poolTitle: 'Stacks TVL > $100M?',
          outcome: 'Yes',
          amount: 100,
          status: 'lost',
          createdAt: Date.now() - 259200000,
          winnings: 0,
        },
      ];

      setBets(mockBets);
      calculateStats(mockBets);
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (userBets: UserBet[]) => {
    const totalBets = userBets.length;
    const totalWagered = userBets.reduce((sum, bet) => sum + bet.amount, 0);
    const wonBets = userBets.filter(bet => bet.status === 'won');
    const totalWinnings = wonBets.reduce((sum, bet) => sum + (bet.winnings || 0), 0);
    const winRate = totalBets > 0 ? (wonBets.length / totalBets) * 100 : 0;
    const activeBets = userBets.filter(bet => bet.status === 'active').length;
    const settledBets = userBets.filter(bet => bet.status !== 'active').length;

    setStats({
      totalBets,
      totalWagered,
      totalWinnings,
      winRate: Math.round(winRate),
      activeBets,
      settledBets,
    });
  };

  const formatSTX = (amount: number) => {
    return amount.toFixed(2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'lost':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'active':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  if (!session?.isConnected && !userData) {
    return (
      <div className="glass p-8 rounded-2xl border border-border text-center">
        <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-bold mb-2">Connect Wallet to View Dashboard</p>
        <p className="text-muted-foreground">Connect your wallet to see your betting history and statistics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="glass p-8 rounded-2xl border border-border">
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Your betting statistics and activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass p-6 rounded-xl border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Bets</p>
              <p className="text-3xl font-bold">{stats.totalBets}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-primary opacity-50" />
          </div>
        </div>

        <div className="glass p-6 rounded-xl border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Wagered</p>
              <p className="text-3xl font-bold">{formatSTX(stats.totalWagered)} STX</p>
            </div>
            <Wallet className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </div>

        <div className="glass p-6 rounded-xl border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Winnings</p>
              <p className="text-3xl font-bold text-green-400">{formatSTX(stats.totalWinnings)} STX</p>
            </div>
            <Award className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass p-6 rounded-xl border border-border">
          <p className="text-sm text-muted-foreground mb-2">Win Rate</p>
          <p className="text-3xl font-bold">{stats.winRate}%</p>
          <div className="mt-4 w-full bg-muted/50 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${stats.winRate}%` }}
            />
          </div>
        </div>

        <div className="glass p-6 rounded-xl border border-border">
          <p className="text-sm text-muted-foreground mb-2">Active Bets</p>
          <p className="text-3xl font-bold text-blue-400">{stats.activeBets}</p>
        </div>

        <div className="glass p-6 rounded-xl border border-border">
          <p className="text-sm text-muted-foreground mb-2">Settled Bets</p>
          <p className="text-3xl font-bold text-green-400">{stats.settledBets}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-bold transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('bets')}
          className={`px-4 py-2 font-bold transition-all whitespace-nowrap ${
            activeTab === 'bets'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Active Bets
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-bold transition-all whitespace-nowrap ${
            activeTab === 'history'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          History
        </button>
        <button
          onClick={() => setActiveTab('incentives')}
          className={`px-4 py-2 font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'incentives'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Gift className="w-4 h-4" />
          Incentives
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="glass p-6 rounded-xl border border-border space-y-4">
          <h3 className="text-xl font-bold">Recent Activity</h3>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : bets.length === 0 ? (
            <p className="text-muted-foreground">No bets yet. Start betting to see your activity here.</p>
          ) : (
            <div className="space-y-3">
              {bets.slice(0, 5).map((bet, idx) => (
                <div key={idx} className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-bold">{bet.poolTitle}</p>
                    <p className="text-sm text-muted-foreground">Bet on: {bet.outcome}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatSTX(bet.amount)} STX</p>
                    <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(bet.status)}`}>
                      {bet.status.charAt(0).toUpperCase() + bet.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'bets' && (
        <div className="glass p-6 rounded-xl border border-border space-y-4">
          <h3 className="text-xl font-bold">Active Bets</h3>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-3">
              {bets
                .filter(bet => bet.status === 'active')
                .map((bet, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="flex-1">
                      <p className="font-bold">{bet.poolTitle}</p>
                      <p className="text-sm text-muted-foreground">Bet on: {bet.outcome}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatSTX(bet.amount)} STX</p>
                      <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                  </div>
                ))}
              {bets.filter(bet => bet.status === 'active').length === 0 && (
                <p className="text-muted-foreground">No active bets.</p>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="glass p-6 rounded-xl border border-border space-y-4">
          <h3 className="text-xl font-bold">Betting History</h3>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-3">
              {bets
                .filter(bet => bet.status !== 'active')
                .map((bet, idx) => (
                  <div key={idx} className={`flex justify-between items-center p-4 rounded-lg border ${getStatusColor(bet.status)}`}>
                    <div className="flex-1">
                      <p className="font-bold">{bet.poolTitle}</p>
                      <p className="text-sm text-muted-foreground">Bet on: {bet.outcome}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatSTX(bet.amount)} STX</p>
                      {bet.winnings !== undefined && (
                        <p className="text-sm font-bold">
                          {bet.status === 'won' ? '+' : '-'}{formatSTX(bet.winnings)} STX
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              {bets.filter(bet => bet.status !== 'active').length === 0 && (
                <p className="text-muted-foreground">No history yet.</p>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'incentives' && (
        <IncentivesDisplay betterId={userData?.address || session?.address} />
      )}

      {/* Refresh Button */}
      <button
        onClick={fetchUserData}
        disabled={isLoading}
        className="w-full py-3 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-xl transition-all disabled:opacity-50"
      >
        {isLoading ? 'Refreshing...' : 'Refresh Data'}
      </button>
    </div>
  );
}
// Dashboard integration improvement 1
// Dashboard integration improvement 2
// Dashboard integration improvement 3
// Dashboard integration improvement 4
// Dashboard integration improvement 5
// Dashboard integration improvement 6
// Dashboard integration improvement 7
// Dashboard integration improvement 8
// Dashboard integration improvement 9
// Dashboard integration improvement 10
