'use client';

import { useState } from 'react';
import { useToast } from '../../providers/ToastProvider';
import { predinexContract } from '../lib/adapters/predinex-contract';
import { Loader2, Wallet, AlertCircle } from 'lucide-react';
import type { Pool } from '@/app/lib/adapters/types';
import { useWallet } from './WalletAdapterProvider';
import { useNetworkMismatch } from '@/lib/hooks/useNetworkMismatch';
import { TruncatedAddress } from '../../components/TruncatedAddress';
import { invalidateOnPlaceBet } from '../lib/cache-invalidation';
import { toastMessages, showToastPayload } from '../../lib/toast-messages';
import { TransactionFeeModal } from './TransactionFeeModal';
import { TxStage } from '../lib/soroban-transaction-service';

interface BettingSectionProps {
    pool: Pool;
    poolId: number;
    onBetSuccess?: (outcome: number, amount: number) => void;
}

export default function BettingSection({ pool, poolId, onBetSuccess }: BettingSectionProps) {
    const wallet = useWallet();
    const { isConnected, address, connect } = wallet;
    const { showToast } = useToast();
    const [betAmount, setBetAmount] = useState("");
    const [isBetting, setIsBetting] = useState(false);
    const [feePrompt, setFeePrompt] = useState<{ feeStroops: string, resolve: (v: boolean) => void } | null>(null);
    const [stage, setStage] = useState<TxStage>('idle');

    const STROOPS_PER_STX = 10_000_000;

    // Per-pool limits (raw units) — optional for legacy pools.
    const minBetStroops = pool.minBet ?? 0;
    const maxBetStroops = pool.maxBet ?? 0;
    const minBetStx = minBetStroops / STROOPS_PER_STX;
    const hasMaxBet = maxBetStroops > 0;
    const maxBetStx = hasMaxBet ? maxBetStroops / STROOPS_PER_STX : null;
    const hasMinBet = minBetStroops > 0;

    // Derived directly from connection state — no effect needed for this mock value
    const walletBalance: number | null = isConnected ? 100.0 : null;

    const { isMismatch, expectedNetworkName } = useNetworkMismatch();

    const placeBet = async (outcome: number) => {
        if (!isConnected) {
            connect();
            return;
        }

        const amountStx = parseFloat(betAmount);
        if (!betAmount || isNaN(amountStx) || amountStx <= 0) {
            showToastPayload(showToast, toastMessages.bet.invalidAmount);
            return;
        }

        const amountStroops = Math.floor(amountStx * STROOPS_PER_STX);

        if (minBetStroops > 0 && amountStroops < minBetStroops) {
            showToastPayload(showToast, toastMessages.bet.minBet(minBetStx));
            return;
        }

        if (hasMaxBet && maxBetStroops > 0 && amountStroops > maxBetStroops) {
            showToastPayload(showToast, toastMessages.bet.maxBet(maxBetStx ?? 0));
            return;
        }

        // Check wallet balance
        if (walletBalance !== null && amountStx > walletBalance) {
            showToastPayload(showToast, toastMessages.bet.insufficientBalance(walletBalance));
            return;
        }

        setIsBetting(true);

        try {
            await predinexContract.placeBetSoroban({
                wallet,
                poolId,
                outcome,
                amountStroops,
                onStageChange: (s) => setStage(s),
                onFeeEstimated: (fee) => {
                    return new Promise((resolve) => {
                        setFeePrompt({ feeStroops: fee, resolve });
                    });
                }
            });
            
            if (address) {
                invalidateOnPlaceBet({ poolId, userAddress: address });
            }
            showToast('Bet placed successfully!', 'success');
            setIsBetting(false);
            setBetAmount("");
            setStage('idle');
            setFeePrompt(null);
            if (onBetSuccess) {
                onBetSuccess(outcome, amountStroops);
            }
        } catch (error) {
            console.error("Bet transaction failed:", error);
            showToast(`Failed to place bet: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            setIsBetting(false);
            setStage('idle');
            setFeePrompt(null);
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
            <TransactionFeeModal
                isOpen={!!feePrompt}
                actionName="Place Bet"
                feeStroops={feePrompt?.feeStroops || '0'}
                onConfirm={() => {
                    feePrompt?.resolve(true);
                    setFeePrompt(null);
                }}
                onCancel={() => {
                    feePrompt?.resolve(false);
                    setFeePrompt(null);
                    setIsBetting(false);
                    setStage('idle');
                }}
                isConfirming={stage === 'signing' || stage === 'submitting' || stage === 'polling'}
            />
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
            {walletBalance !== null && walletBalance < minBetStx && !isMismatch && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-600">
                        Insufficient balance to place bets. Minimum: {minBetStx} XLM
                    </p>
                </div>
            )}

            {/* Network Mismatch Warning */}
            {isMismatch && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-600">
                        Please switch to {expectedNetworkName} to place bets.
                    </p>
                </div>
            )}

            {/* Bet Amount Input */}
            <div>
                <label className="block text-sm font-medium mb-2">Bet Amount (XLM)</label>
                <input
                    type="number"
                    step="0.1"
                    min={hasMinBet ? String(minBetStx) : undefined}
                    max={hasMaxBet && maxBetStx !== null ? String(maxBetStx) : undefined}
                    className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="e.g., 10"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    disabled={isBetting || (walletBalance !== null && walletBalance < minBetStx) || isMismatch}
                    aria-label="Enter bet amount in XLM"
                />
                <p className="text-xs text-muted-foreground mt-2">
                    Bet limits:{' '}
                    {hasMinBet ? `Min ${minBetStx} XLM` : 'No minimum'}
                    {hasMaxBet && maxBetStx !== null ? `, Max ${maxBetStx} XLM` : ', No maximum'}
                </p>
            </div>

            {/* Bet Buttons */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => placeBet(0)}
                    disabled={isBetting || (walletBalance !== null && walletBalance < minBetStx) || isMismatch}
                    className="py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                >
                    {isBetting ? <Loader2 className="w-5 h-5 animate-spin" /> : isMismatch ? 'Wrong Network' : `Bet on ${pool.outcomeA}`}
                </button>
                <button
                    onClick={() => placeBet(1)}
                    disabled={isBetting || (walletBalance !== null && walletBalance < minBetStx) || isMismatch}
                    className="py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                >
                    {isBetting ? <Loader2 className="w-5 h-5 animate-spin" /> : isMismatch ? 'Wrong Network' : `Bet on ${pool.outcomeB}`}
                </button>
            </div>
        </div>
    );
}