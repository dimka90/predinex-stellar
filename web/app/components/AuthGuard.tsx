'use client';

import { ReactNode } from 'react';
import { useWallet } from './WalletAdapterProvider';
import { Wallet, Lock } from 'lucide-react';

interface AuthGuardProps {
    children: ReactNode;
    fallback?: ReactNode;
}

export default function AuthGuard({ children, fallback }: AuthGuardProps) {
    const { isConnected, connect } = useWallet();

    if (!isConnected) {
        return fallback || (
            <div className="pt-32 pb-20 max-w-2xl mx-auto px-4 sm:px-6">
                <div className="glass p-8 rounded-2xl border border-border text-center">
                    <Lock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
                    <p className="text-muted-foreground mb-6">
                        You need to connect your wallet to access this feature.
                    </p>
                    <button
                        onClick={connect}
                        className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-6 py-3 rounded-full border border-primary/20 transition-colors font-medium mx-auto hover:scale-105 transform transition-transform"
                    >
                        <Wallet className="w-5 h-5" />
                        Connect Wallet
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}