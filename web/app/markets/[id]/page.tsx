'use client';

import Navbar from "../../components/Navbar";
import BettingSection from "../../components/BettingSection";
import ClaimWinningsButton from "../../../components/ClaimWinningsButton";
import SettledPoolSummary from "../../components/SettledPoolSummary";
import { useWallet } from "../../components/WalletAdapterProvider";
import { useEffect, useState } from "react";
import { predinexReadApi } from "../../lib/adapters/predinex-read-api";
import type { Pool } from "../../lib/adapters/types";
import { TrendingUp, Users, Clock } from "lucide-react";
import { use } from "react";
import ShareButton from "../../../components/ShareButton";
import { TruncatedAddress } from "../../../components/TruncatedAddress";

export default function PoolDetails({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const poolId = parseInt(id);

    const { address: stxAddress } = useWallet();

    const [pool, setPool] = useState<Pool | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [userBet, setUserBet] = useState<{ amountA: number; amountB: number } | null>(null);

    useEffect(() => {
        predinexReadApi.getPool(poolId).then(data => {
            setPool(data);
            setIsLoading(false);
        });
    }, [poolId]);

    useEffect(() => {
        if (stxAddress && poolId) {
            predinexReadApi.getUserBet(poolId, stxAddress).then(bet => {
                setUserBet(bet);
            }).catch(() => setUserBet(null));
        }
    }, [stxAddress, poolId]);

    const refreshPoolData = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);

        try {
            const [newPool, newBet] = await Promise.all([
                predinexReadApi.getPool(poolId),
                stxAddress ? predinexReadApi.getUserBet(poolId, stxAddress) : Promise.resolve(null)
            ]);

            if (newPool) setPool(newPool);
            if (newBet) setUserBet(newBet);
        } catch (error) {
            console.error("Failed to refresh pool data:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleBetSuccess = (outcome: number, amountMicroSTX: number) => {
        // Optimistic update
        const amount = amountMicroSTX; // Since pool totals are in microSTX as well (verified in stacks-api.ts)
        setPool(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                totalA: outcome === 0 ? prev.totalA + amount : prev.totalA,
                totalB: outcome === 1 ? prev.totalB + amount : prev.totalB,
            };
        });

        // Trigger real refresh after a small delay to allow on-chain propagation
        // and handle potential backend indexing delays.
        setTimeout(refreshPoolData, 3000);
        // Also refresh immediately to catch any mempool updates if supported by the node
        refreshPoolData();
    };

    const userHasWinnings = pool?.settled && userBet &&
        ((pool.winningOutcome === 0 && userBet.amountA > 0) ||
            (pool.winningOutcome === 1 && userBet.amountB > 0));



    if (isLoading) {
        return (
            <main className="min-h-screen bg-background text-foreground">
                <Navbar />
                <div className="pt-32 text-center">Loading pool...</div>
            </main>
        );
    }

    if (!pool) {
        return (
            <main className="min-h-screen bg-background text-foreground">
                <Navbar />
                <div className="pt-32 text-center text-red-500">Pool not found.</div>
            </main>
        );
    }

    const totalVolume = pool.totalA + pool.totalB;
    const oddsA = totalVolume > 0 ? ((pool.totalA / totalVolume) * 100).toFixed(1) : 50;
    const oddsB = totalVolume > 0 ? ((pool.totalB / totalVolume) * 100).toFixed(1) : 50;

    return (
        <main className="min-h-screen bg-background text-foreground">
            <Navbar />

            <div className="pt-32 pb-20 max-w-3xl mx-auto px-4 sm:px-6">
                <div className="glass p-8 rounded-2xl border border-border">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                        <span className="text-xs font-mono text-muted-foreground">#POOL-{pool.id}</span>
                        <div className="flex items-center gap-3">
                            <ShareButton
                                title={pool.title}
                                text={`Check out this prediction market: ${pool.title}`}
                            />
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${pool.settled ? 'bg-zinc-800 text-zinc-400' : 'bg-green-500/10 text-green-500'}`}>
                                {pool.settled ? 'Settled' : 'Active'}
                            </span>
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold mb-3">{pool.title}</h1>
                    <p className="text-muted-foreground mb-8">{pool.description}</p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="bg-muted/50 p-4 rounded-lg text-center">
                            <TrendingUp className="w-5 h-5 mx-auto mb-2 text-primary" />
                            <p className="text-sm text-muted-foreground">Total Volume</p>
                            <p className="font-bold">{(totalVolume / 1_000_000).toLocaleString()} STX</p>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg text-center">
                            <Users className="w-5 h-5 mx-auto mb-2 text-accent" />
                            <p className="text-sm text-muted-foreground">Creator</p>
                            <p className="font-mono text-xs truncate">
                                <TruncatedAddress address={pool.creator} />
                            </p>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg text-center">
                            <Clock className="w-5 h-5 mx-auto mb-2 text-yellow-500" />
                            <p className="text-sm text-muted-foreground">Expires</p>
                            <p className="font-bold">Block {pool.expiry}</p>
                        </div>
                    </div>

                    {/* Odds Display */}
                    <div className="mb-8">
                        <p className="text-sm text-muted-foreground mb-2">Current Odds</p>
                        <div className="flex h-4 rounded-full overflow-hidden">
                            <div
                                className="bg-green-500 transition-all"
                                style={{ width: `${oddsA}%` }}
                            />
                            <div
                                className="bg-red-500 transition-all"
                                style={{ width: `${oddsB}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-sm">
                            <span className="text-green-400">{pool.outcomeA}: {oddsA}%</span>
                            <span className="text-red-400">{pool.outcomeB}: {oddsB}%</span>
                        </div>
                    </div>

                    {/* User Bet Summary Card */}
                    {userBet && (userBet.amountA > 0 || userBet.amountB > 0) && (
                        <div className="mb-8 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                            <h3 className="text-lg font-semibold mb-3">Your Position</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className={`p-3 rounded-lg ${userBet.amountA > 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/50'}`}>
                                    <p className="text-sm text-muted-foreground">{pool.outcomeA}</p>
                                    <p className="text-xl font-bold">{(userBet.amountA / 1_000_000).toFixed(2)} STX</p>
                                </div>
                                <div className={`p-3 rounded-lg ${userBet.amountB > 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-muted/50'}`}>
                                    <p className="text-sm text-muted-foreground">{pool.outcomeB}</p>
                                    <p className="text-xl font-bold">{(userBet.amountB / 1_000_000).toFixed(2)} STX</p>
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-primary/20 flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Total Staked</span>
                                <span className="font-bold">{((userBet.amountA + userBet.amountB) / 1_000_000).toFixed(2)} STX</span>
                            </div>
                            {pool.settled && userHasWinnings && (
                                <div className="mt-2 text-sm text-green-400">
                                    Winner: {pool.winningOutcome === 0 ? pool.outcomeA : pool.outcomeB}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Betting UI / Settled Summary */}
                    {pool.settled ? (
                        <div className="mt-6">
                            <SettledPoolSummary pool={pool} />
                            <ClaimWinningsButton
                                poolId={poolId}
                                isSettled={pool.settled}
                                userHasWinnings={!!userHasWinnings}
                                userAddress={stxAddress}
                                onClaimSuccess={refreshPoolData}
                            />
                        </div>
                    ) : (
                        <div className="relative">
                            {isRefreshing && (
                                <div className="absolute -top-6 right-0 flex items-center gap-2 text-xs text-primary animate-pulse">
                                    <div className="w-2 h-2 bg-primary rounded-full" />
                                    Reconciling on-chain data...
                                </div>
                            )}
                            <BettingSection
                                pool={pool}
                                poolId={poolId}
                                onBetSuccess={handleBetSuccess}
                            />
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
