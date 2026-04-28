'use client';

import { useState } from 'react';
import { useToast } from '../../providers/ToastProvider';
import { predinexContract } from '../lib/adapters/predinex-contract';
import { Loader2, Wallet, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import type { Pool } from '@/app/lib/adapters/types';
import { useWallet } from './WalletAdapterProvider';
import { useStacks } from './StacksProvider';
import { useNetworkMismatch } from '@/lib/hooks/useNetworkMismatch';
import { useTxStatus } from '../lib/hooks/useTxStatus';
import { TruncatedAddress } from '../../components/TruncatedAddress';
import {
    classifyConnectivityIssue,
} from '../lib/network-errors';
import { invalidateOnPlaceBet } from '../lib/cache-invalidation';
import { toastMessages, connectivityErrorToast, showToastPayload } from '../../lib/toast-messages';

// Minimum bet amount in STX
const MIN_BET_STX = 0.1;

interface BettingSectionProps {
    pool: Pool;
    poolId: number;
    onBetSuccess?: (outcome: number, amount: number) => void;
}

export default function BettingSection({ pool, poolId, onBetSuccess }: BettingSectionProps) {
    const { isConnected, address, connect } = useWallet();
    const { showToast } = useToast();
    const [betAmount, setBetAmount] = useState("");
    const [isBetting, setIsBetting] = useState(false);

    // Placeholder for XLM minimums
    const MIN_BET_XLM = 0.1;

    // Derived directly from connection state — no effect needed for this mock value
    const walletBalance: number | null = isConnected ? 100.0 : null;

    const placeBet = async (outcome: number) => {
        if (!isConnected) {
            connect();
            return;
        }

        const amount = parseFloat(betAmount);
        if (!betAmount || isNaN(amount) || amount <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }

        if (amount < MIN_BET_XLM) {
            showToast(`Minimum bet is ${MIN_BET_XLM} XLM`, 'error');
            return;
        }

        // Check wallet balance
        if (walletBalance !== null && amount > walletBalance) {
            showToast(`Insufficient balance. Available: ${walletBalance} XLM`, 'error');
            return;
        }

        setIsBetting(true);
        const amountInStroops = Math.floor(parseFloat(betAmount) * 10_000_000);

        try {
            await predinexContract.placeBet({
                poolId,
                outcome,
                amountMicroStx: amountInStroops,
                onFinish: () => {
                    if (address) {
                        invalidateOnPlaceBet({ poolId, userAddress: address });
                    }
                    showToast('Bet placed successfully!', 'success');
                    setIsBetting(false);
                    setBetAmount("");
                    if (onBetSuccess) {
                        onBetSuccess(outcome, amountInStroops);
                    }
                },
                onCancel: () => {
                    showToast('Transaction cancelled', 'info');
                    setIsBetting(false);
                },
            });
        } catch (error) {
            console.error("Bet transaction failed:", error);
            showToast('Failed to place bet', 'error');
            setIsBetting(false);
        }
    };

    if (pool.settled) {
        return (
            <div className="text-center py-6 bg-muted/50 rounded-lg">
                <p className="text-lg font-bold">This pool has been settled.</p>
                <p className="text-muted-foreground">Winner: {pool.winningOutcome === 0 ? pool.outcomeA : pool.outcomeB}</p>
            </div>
        );
    }

    if (!isConnected) {
        return (
            <div className="text-center py-6 bg-muted/50 rounded-lg">
                <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-bold mb-2">Connect Wallet to Bet</p>
                <p className="text-muted-foreground mb-4">You need to connect your wallet to place bets on this market.</p>
                <button
                    onClick={connect}
                    className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-6 py-3 rounded-full border border-primary/20 transition font-medium mx-auto hover:scale-105"
                >
                    <Wallet className="w-5 h-5" />
                    Connect Wallet
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Wallet Info */}
            {isConnected && address && (
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-muted-foreground">Connected Wallet</p>
                            <TruncatedAddress address={address} className="font-mono text-sm" />
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Balance</p>
                            <p className="font-bold">{walletBalance?.toFixed(2) || '0'} XLM</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Balance Warning */}
            {walletBalance !== null && walletBalance < MIN_BET_XLM && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-600">
                        Insufficient balance to place bets. Minimum: {MIN_BET_XLM} XLM
                    </p>
                </div>
            )}

            {/* Bet Amount Input */}
            <div>
                <label className="block text-sm font-medium mb-2">Bet Amount (XLM)</label>
                <input
                    type="number"
                    step="0.1"
                    min={String(MIN_BET_XLM)}
                    className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="e.g., 10"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    disabled={isBetting || (walletBalance !== null && walletBalance < MIN_BET_XLM)}
                    aria-label="Enter bet amount in XLM"
                />
            </div>

            {/* Bet Buttons */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => placeBet(0)}
                    disabled={isBetting || (walletBalance !== null && walletBalance < MIN_BET_XLM)}
                    className="py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                >
                    {isBetting ? <Loader2 className="w-5 h-5 animate-spin" /> : `Bet on ${pool.outcomeA}`}
                </button>
                <button
                    onClick={() => placeBet(1)}
                    disabled={isBetting || (walletBalance !== null && walletBalance < MIN_BET_XLM)}
                    className="py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                >
                    {isBetting ? <Loader2 className="w-5 h-5 animate-spin" /> : `Bet on ${pool.outcomeB}`}
                </button>
            </div>
        </div>
    );
}