'use client';

/**
 * WalletModal - Unified wallet connection modal
 * Supports multiple wallet options: Leather, Xverse, and WalletConnect
 */

import { X, Wallet, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import { isWalletAvailable, WalletType } from '../lib/wallet-connector';

interface WalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectWallet: (walletType: 'leather' | 'xverse' | 'walletconnect') => void;
    error?: string;
}

export default function WalletModal({ isOpen, onClose, onSelectWallet, error }: WalletModalProps) {
    // Derived directly from isOpen — no state or effect needed; isWalletAvailable is
    // SSR-safe and cheap to call on each render.
    const walletAvailability: Record<WalletType, boolean> = isOpen
        ? {
              leather: isWalletAvailable('leather'),
              xverse: isWalletAvailable('xverse'),
              walletconnect: isWalletAvailable('walletconnect'),
          }
        : { leather: false, xverse: false, walletconnect: true };

    if (!isOpen) return null;

    const wallets = [
        {
            id: 'leather' as const,
            name: 'Leather',
            description: 'Not supported on Stellar',
            icon: Wallet,
            isSupported: false,
        },
        {
            id: 'xverse' as const,
            name: 'Xverse',
            description: 'Not supported on Stellar',
            icon: Wallet,
            isSupported: false,
        },
        {
            id: 'walletconnect' as const,
            name: 'WalletConnect',
            description: 'Connect with Stellar-compatible wallet via QR code',
            icon: Smartphone,
            isSupported: true,
        },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="glass border border-border rounded-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Connect Wallet</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-500 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                <div className="space-y-3">
                    {wallets.map((wallet) => {
                        const Icon = wallet.icon;
                        return (
                            <button
                                key={wallet.id}
                                onClick={() => {
                                    onSelectWallet(wallet.id);
                                    onClose();
                                }}
                                disabled={!wallet.isSupported || (!walletAvailability[wallet.id] && wallet.id !== 'walletconnect')}
                                aria-label={!wallet.isSupported
                                    ? `Connect using ${wallet.name} (Unsupported)`
                                    : walletAvailability[wallet.id]
                                        ? `Connect using ${wallet.name} (Available)`
                                        : wallet.id === 'walletconnect'
                                            ? `Connect using WalletConnect (via QR code)`
                                            : `Connect using ${wallet.name} (Not installed)`
                                }
                                aria-disabled={!wallet.isSupported || (!walletAvailability[wallet.id] && wallet.id !== 'walletconnect')}
                                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed relative"
                            >
                                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Icon className="w-6 h-6 text-primary" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="font-semibold flex items-center gap-2">
                                        {wallet.name}
                                        {!wallet.isSupported && (
                                            <span className="text-[10px] uppercase tracking-wider bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-medium">
                                                Unsupported
                                            </span>
                                        )}
                                        {wallet.isSupported && walletAvailability[wallet.id] && wallet.id !== 'walletconnect' && (
                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                        )}
                                    </div>
                                    <div className="text-sm text-muted-foreground">{wallet.description}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

