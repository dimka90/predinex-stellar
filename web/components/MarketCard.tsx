import Link from 'next/link';
import { Pool } from '@/app/lib/stacks-api';
import { TrendingUp, Clock, ChevronRight } from 'lucide-react';
import MarketCardHeader from './ui/MarketCardHeader';
import ClaimWinningsButton from './ClaimWinningsButton';

export default function MarketCard({ market }: { market: Pool }) {
    // In a real app, we would check if the user has a winning bet.
    // For now, we show it if settled, as the button itself handles the contract interaction.
    const canClaim = market.status === 'settled';

    return (
        <div className="group block h-full rounded-3xl relative">
            <Link
                href={`/markets/${market.id}`}
                className="block h-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-3xl"
                aria-label={`View details for market: ${market.title}`}
            >
                <div
                    className="p-8 rounded-3xl border border-border bg-card/40 hover:bg-card/60 hover:border-primary/40 transition-all h-full flex flex-col glass hover-lift relative overflow-hidden"
                    role="article"
                >
                    {/* Status Badge */}
                    <MarketCardHeader id={market.id} status={market.status} />

                    <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                        {market.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-8 line-clamp-2 grow leading-relaxed font-medium">
                        {market.description}
                    </p>

                    <div className="flex items-center justify-between pt-6 border-t border-border/50">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-1" aria-label={`Pool volume: ${(market.totalA + market.totalB).toLocaleString()} STX`}>
                                <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest" aria-hidden="true">Volume</span>
                                <div className="flex items-center gap-1.5 font-bold text-sm">
                                    <TrendingUp className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                    <span>{(market.totalA + market.totalB).toLocaleString()} STX</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1" aria-label={`Expiry block: ${market.expiry}`}>
                                <span className="text-[9px] uppercase font-black text-muted-foreground tracking-widest" aria-hidden="true">Expiry</span>
                                <div className="flex items-center gap-1.5 font-bold text-sm">
                                    <Clock className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                                    <span>Block {market.expiry}</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-primary/10 p-2 rounded-xl group-hover:bg-primary group-hover:text-white transition-all">
                            <ChevronRight className="h-4 w-4" />
                        </div>
                    </div>

                    {/* Subtle gradient overlay on hover */}
                    <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </div>
            </Link>

            {canClaim && (
                <div className="absolute bottom-24 right-8 z-10 transition-transform hover:scale-105 active:scale-95">
                    <ClaimWinningsButton
                        poolId={market.id}
                        isSettled={true}
                        userHasWinnings={true}
                    />
                </div>
            )}
        </div>
    );
}
