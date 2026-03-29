import { useState } from 'react';
import type { Pool } from '@/app/lib/adapters/types';

export default function BettingSection({ pool, poolId }: { pool: Pool, poolId: number }) {
    const [selectedOutcome, setSelectedOutcome] = useState<'A' | 'B' | null>(null);
    const [amount, setAmount] = useState('');

    return (
        <div className="bg-muted/30 p-6 rounded-xl border border-border">
            <h3 className="font-bold mb-4">Place Bet</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                    onClick={() => setSelectedOutcome('A')}
                    className={`p-4 rounded-lg font-bold transition-all ${selectedOutcome === 'A' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                >
                    {pool.outcomeA}
                </button>
                <button
                    onClick={() => setSelectedOutcome('B')}
                    className={`p-4 rounded-lg font-bold transition-all ${selectedOutcome === 'B' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                >
                    {pool.outcomeB}
                </button>
            </div>
            
            <div className="mb-4">
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Amount (STX)"
                    className="w-full px-4 py-3 rounded-lg bg-background border border-input outline-none focus:border-primary"
                />
            </div>
            
            <button className="w-full py-4 bg-linear-to-r from-primary to-purple-600 rounded-lg font-bold hover:opacity-90 transition-opacity">
                Place Bet
            </button>
        </div>
    );
}
