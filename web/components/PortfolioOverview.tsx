"use client";

import { useWallet } from '../app/components/WalletAdapterProvider';
import { TruncatedAddress } from './TruncatedAddress';
import { Wallet, CircleDollarSign, Info } from 'lucide-react';
import Card from './ui/Card';
import Tooltip from './ui/Tooltip';

export default function PortfolioOverview() {
    const { isConnected, address } = useWallet();

    if (!isConnected) return null;

    return (
        <div className="mb-8 p-8 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/5 glass relative overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                <div>
                    <h2 className="text-3xl font-black mb-1 flex items-center gap-2">
                        Portfolio Overview
                        <Tooltip content="Live stats from your Stacks wallet address">
                            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                        </Tooltip>
                    </h2>
                    <p className="text-muted-foreground font-medium flex items-center gap-2">
                        <Wallet className="w-4 h-4" />
                        {address ? <TruncatedAddress address={address} /> : null}
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 w-full md:w-auto">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-primary tracking-widest mb-1">Total Wagered</span>
                        <span className="text-2xl font-black">1,250 STX</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-accent tracking-widest mb-1">Total Won</span>
                        <span className="text-2xl font-black">840 STX</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-green-400 tracking-widest mb-1">Net P/L</span>
                        <div className="flex items-center gap-2">
                            <CircleDollarSign className="w-5 h-5 text-green-400" />
                            <span className="text-2xl font-black text-green-400">+590 STX</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Decorative background element */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[120px] rounded-full -mr-32 -mt-32 animate-pulse" />
        </div>
    );
}
