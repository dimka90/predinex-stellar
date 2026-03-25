'use client';

import Navbar from "../../components/Navbar";
import BettingSection from "../../components/BettingSection";
import ClaimWinningsButton from "../../components/ClaimWinningsButton";
import { useStacks } from "../../components/StacksProvider";
import { useEffect, useState } from "react";
import { getPool, Pool, getUserBets } from "../../lib/stacks-api";
import { TrendingUp, Users, Clock } from "lucide-react";
import { use } from "react";
import ShareButton from "../../../components/ShareButton";

export default function PoolDetails({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const poolId = parseInt(id);

    const { userData } = useStacks();
    const stxAddress = userData?.profile?.stxAddress?.mainnet || userData?.profile?.stxAddress?.testnet || userData?.identityAddress;

    const [pool, setPool] = useState<Pool | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userBet, setUserBet] = useState<{amountA: number; amountB: number} | null>(null);

    useEffect(() => {
        getPool(poolId).then(data => {
            setPool(data);
            setIsLoading(false);
        });
    }, [poolId]);

    useEffect(() => {
        if (stxAddress && poolId) {
            getUserBet(poolId, stxAddress).then(bet => {
                setUserBet(bet);
            }).catch(() => setUserBet(null));
        }
    }, [stxAddress, poolId]);

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
                            <p className="font-mono text-xs truncate">{pool.creator.slice(0, 8)}...</p>
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

                    {/* Betting UI */}
                    {pool.settled ? (
                        <div className="mt-6">
                            <ClaimWinningsButton 
                                poolId={poolId} 
                                isSettled={pool.settled} 
                                userHasWinnings={userHasWinnings} 
                            />
                        </div>
                    ) : (
                        <BettingSection pool={pool} poolId={poolId} />
                    )}
                </div>
            </div>
        </main>
    );
}
