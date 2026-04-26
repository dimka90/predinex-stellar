"use client";

import { useState } from 'react';
import { predinexContract } from '@/app/lib/adapters/predinex-contract';
import { useWallet } from '../app/components/WalletAdapterProvider';
import { Loader2, Coins } from 'lucide-react';

interface ClaimWinningsButtonProps {
    poolId: number;
    isSettled: boolean;
    userHasWinnings: boolean;
}

export default function ClaimWinningsButton({ poolId, isSettled, userHasWinnings }: ClaimWinningsButtonProps) {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { isConnected } = useWallet();

    const handleClaim = async () => {
        if (!isConnected) return;

        setIsPending(true);
        setError(null);

        try {
            await predinexContract.claimWinnings({
                poolId,
                onFinish: (data) => {
                    console.log('Claim submitted:', data);
                    setIsPending(false);
                },
                onCancel: () => {
                    setIsPending(false);
                }
            });
        } catch (err: any) {
            console.error('Claim error:', err);
            setError(err.message || 'Failed to claim');
            setIsPending(false);
        }
    };

    if (!isSettled || !userHasWinnings) return null;

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handleClaim}
                disabled={isPending}
                className="flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-yellow-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
                {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Coins className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                )}
                {isPending ? 'Processing...' : 'Claim Winnings'}
            </button>
            {error && <p className="text-red-400 text-xs text-center font-medium animate-pulse">{error}</p>}
        </div>
    );
}
