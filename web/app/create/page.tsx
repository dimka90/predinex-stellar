'use client';

import { FormEvent, useState } from 'react';
import Navbar from '../components/Navbar';
import AuthGuard from '../components/AuthGuard';
import { useWallet } from '../components/WalletAdapterProvider';
import { useToast } from '../../providers/ToastProvider';
import { useLocalStorage } from '../lib/hooks/useLocalStorage';
import { validatePoolCreationForm, validateField, getCharLimit, getHelpText } from '../lib/validators';
import { predinexContract } from '../lib/adapters/predinex-contract';
import { invalidateOnCreatePool } from '../lib/cache-invalidation';
import { Loader2 } from 'lucide-react';
import { TxStage } from '../lib/soroban-transaction-service';
import { TransactionFeeModal } from '../components/TransactionFeeModal';

const CREATE_MARKET_DRAFT_KEY = 'predinex_create_market_draft_v1';

interface CreateMarketDraft {
    title: string;
    description: string;
    outcomeA: string;
    outcomeB: string;
    duration: string;
    category: string;
    referenceLink: string;
}

const EMPTY_DRAFT: CreateMarketDraft = {
    title: '',
    description: '',
    outcomeA: '',
    outcomeB: '',
    duration: '',
    category: 'crypto',
    referenceLink: '',
};

type FormErrors = Partial<Record<keyof CreateMarketDraft, string>>;

export default function CreateMarket() {
    const wallet = useWallet();
    const { showToast } = useToast();
    const [draft, setDraft, clearDraft] = useLocalStorage<CreateMarketDraft>(
        CREATE_MARKET_DRAFT_KEY,
        EMPTY_DRAFT
    );
    const [errors, setErrors] = useState<FormErrors>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [stage, setStage] = useState<TxStage>('idle');
    const [txId, setTxId] = useState<string | null>(null);
    const [feePrompt, setFeePrompt] = useState<{ feeStroops: string; resolve: (v: boolean) => void } | null>(null);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setDraft((prev) => ({ ...prev, [name]: value }));

        // Real-time inline validation on change
        const fieldError = validateField(name as keyof CreateMarketDraft, value);
        setErrors((prev) => ({ ...prev, [name]: fieldError }));
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setTouched((prev) => ({ ...prev, [name]: true }));

        // Validate on blur
        const fieldError = validateField(name as keyof CreateMarketDraft, value);
        setErrors((prev) => ({ ...prev, [name]: fieldError }));
    };

    const getStageLabel = (s: TxStage) => {
        switch (s) {
            case 'simulating': return 'Simulating transaction…';
            case 'signing': return 'Waiting for signature…';
            case 'submitting': return 'Submitting to network…';
            case 'polling': return 'Confirming transaction…';
            default: return 'Submitting…';
        }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!wallet.isConnected) {
            wallet.connect();
            return;
        }

        const duration = parseInt(draft.duration, 10);
        const validation = validatePoolCreationForm({
            title: draft.title,
            description: draft.description,
            outcomeA: draft.outcomeA,
            outcomeB: draft.outcomeB,
            duration: isNaN(duration) ? 0 : duration,
        });

        if (!validation.valid) {
            setErrors(validation.errors as FormErrors);
            // Mark all fields as touched
            setTouched({
                title: true,
                description: true,
                outcomeA: true,
                outcomeB: true,
                duration: true,
            });
            return;
        }

        setIsSubmitting(true);
        setStage('idle');
        try {
            const { txHash } = await predinexContract.createMarketSoroban({
                wallet,
                title: draft.title,
                description: draft.description,
                outcomeA: draft.outcomeA,
                outcomeB: draft.outcomeB,
                durationSeconds: duration,
                onStageChange: (s) => setStage(s),
                onFeeEstimated: (fee) => {
                    return new Promise((resolve) => {
                        setFeePrompt({ feeStroops: fee, resolve });
                    });
                },
            });

            setTxId(txHash);
            clearDraft();
            invalidateOnCreatePool();
            showToast('Market created successfully!', 'success');
        } catch (error) {
            console.error('Failed to create market:', error);
            showToast(`Failed to create market: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        } finally {
            setIsSubmitting(false);
            setStage('idle');
            setFeePrompt(null);
        }
    };

    const charCount = (value: string, max: number) => (
        <span className={`text-xs ${value.length > max ? 'text-red-500' : value.length > max * 0.9 ? 'text-orange-500' : 'text-muted-foreground'}`}>
            {value.length}/{max}
        </span>
    );

    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <AuthGuard>
                <div className="container mx-auto px-4 py-12 max-w-2xl">
                    <h1 className="text-3xl font-bold mb-8">Create New Market</h1>

                    <TransactionFeeModal
                        isOpen={!!feePrompt}
                        actionName="Create Pool"
                        feeStroops={feePrompt?.feeStroops || '0'}
                        onConfirm={() => {
                            feePrompt?.resolve(true);
                            setFeePrompt(null);
                        }}
                        onCancel={() => {
                            feePrompt?.resolve(false);
                            setFeePrompt(null);
                            setIsSubmitting(false);
                            setStage('idle');
                        }}
                        isConfirming={stage === 'signing' || stage === 'submitting' || stage === 'polling'}
                    />

                    {txId && (
                        <div role="status" className="mb-6 p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400">
                            <p className="font-semibold">Market created!</p>
                            <p className="text-sm mt-1 font-mono break-all">Tx: {txId}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate className="space-y-6">
                        <div className="p-6 rounded-xl border border-border space-y-5">

                            {/* Title */}
                            <div>
                                <label htmlFor="title" className="block text-sm font-medium mb-1">
                                    Question / Title
                                </label>
                                <input
                                    id="title"
                                    name="title"
                                    type="text"
                                    value={draft.title}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="e.g. Will Bitcoin be above $100k by end of 2025?"
                                    className={`w-full px-4 py-2 rounded-lg bg-background border focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                                        touched.title && errors.title ? 'border-red-500' : 'border-input'
                                    }`}
                                    aria-describedby={errors.title ? 'title-error' : 'title-help'}
                                    aria-invalid={!!errors.title}
                                    autoComplete="off"
                                />
                                <div className="flex justify-between items-center mt-1">
                                    {errors.title && touched.title ? (
                                        <p id="title-error" role="alert" className="text-sm text-red-500">{errors.title}</p>
                                    ) : (
                                        <p id="title-help" className="text-xs text-muted-foreground">{getHelpText('title')}</p>
                                    )}
                                    {charCount(draft.title, 100)}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label htmlFor="description" className="block text-sm font-medium mb-1">
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    name="description"
                                    rows={3}
                                    value={draft.description}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Provide context and resolution criteria for this market."
                                    className={`w-full px-4 py-2 rounded-lg bg-background border focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none ${
                                        touched.description && errors.description ? 'border-red-500' : 'border-input'
                                    }`}
                                    aria-describedby={errors.description ? 'description-error' : 'description-help'}
                                    aria-invalid={!!errors.description}
                                />
                                <div className="flex justify-between items-center mt-1">
                                    {errors.description && touched.description ? (
                                        <p id="description-error" role="alert" className="text-sm text-red-500">{errors.description}</p>
                                    ) : (
                                        <p id="description-help" className="text-xs text-muted-foreground">{getHelpText('description')}</p>
                                    )}
                                    {charCount(draft.description, 500)}
                                </div>
                            </div>

                            {/* Outcomes */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="outcomeA" className="block text-sm font-medium mb-1">Outcome A</label>
                                    <input
                                        id="outcomeA"
                                        name="outcomeA"
                                        type="text"
                                        value={draft.outcomeA}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        placeholder="e.g. Yes"
                                        className={`w-full px-4 py-2 rounded-lg bg-background border focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                                            touched.outcomeA && errors.outcomeA ? 'border-red-500' : 'border-input'
                                        }`}
                                        aria-describedby={errors.outcomeA ? 'outcomeA-error' : 'outcomeA-help'}
                                        aria-invalid={!!errors.outcomeA}
                                    />
                                    <div className="flex justify-between items-center mt-1">
                                        {errors.outcomeA && touched.outcomeA ? (
                                            <p id="outcomeA-error" role="alert" className="text-sm text-red-500">{errors.outcomeA}</p>
                                        ) : (
                                            <p id="outcomeA-help" className="text-xs text-muted-foreground">{getHelpText('outcomeA')}</p>
                                        )}
                                        {charCount(draft.outcomeA, 50)}
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="outcomeB" className="block text-sm font-medium mb-1">Outcome B</label>
                                    <input
                                        id="outcomeB"
                                        name="outcomeB"
                                        type="text"
                                        value={draft.outcomeB}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        placeholder="e.g. No"
                                        className={`w-full px-4 py-2 rounded-lg bg-background border focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                                            touched.outcomeB && errors.outcomeB ? 'border-red-500' : 'border-input'
                                        }`}
                                        aria-describedby={errors.outcomeB ? 'outcomeB-error' : 'outcomeB-help'}
                                        aria-invalid={!!errors.outcomeB}
                                    />
                                    <div className="flex justify-between items-center mt-1">
                                        {errors.outcomeB && touched.outcomeB ? (
                                            <p id="outcomeB-error" role="alert" className="text-sm text-red-500">{errors.outcomeB}</p>
                                        ) : (
                                            <p id="outcomeB-help" className="text-xs text-muted-foreground">{getHelpText('outcomeB')}</p>
                                        )}
                                        {charCount(draft.outcomeB, 50)}
                                    </div>
                                </div>
                            </div>

                            {/* Duration */}
                            <div>
                                <label htmlFor="duration" className="block text-sm font-medium mb-1">Duration (seconds)</label>
                                <input
                                    id="duration"
                                    name="duration"
                                    type="number"
                                    min={300}
                                    value={draft.duration}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="e.g. 86400 (1 day on Stellar)"
                                    className={`w-full px-4 py-2 rounded-lg bg-background border focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                                        touched.duration && errors.duration ? 'border-red-500' : 'border-input'
                                    }`}
                                    aria-describedby={errors.duration ? 'duration-error' : 'duration-help'}
                                    aria-invalid={!!errors.duration}
                                />
                                {errors.duration && touched.duration ? (
                                    <p id="duration-error" role="alert" className="mt-1 text-sm text-red-500">{errors.duration}</p>
                                ) : (
                                    <p id="duration-help" className="mt-1 text-xs text-muted-foreground">{getHelpText('duration')}</p>
                                )}
                            </div>

                            {/* Category */}
                            <div>
                                <label htmlFor="category" className="block text-sm font-medium mb-1">Category</label>
                                <select
                                    id="category"
                                    name="category"
                                    value={draft.category}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="crypto">Cryptocurrency</option>
                                    <option value="sports">Sports</option>
                                    <option value="politics">Politics</option>
                                    <option value="tech">Technology</option>
                                    <option value="weather">Weather</option>
                                    <option value="finance">Finance</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            {/* Reference Link */}
                            <div>
                                <label htmlFor="referenceLink" className="block text-sm font-medium mb-1">External Reference Link (optional)</label>
                                <input
                                    id="referenceLink"
                                    name="referenceLink"
                                    type="url"
                                    value={draft.referenceLink}
                                    onChange={handleChange}
                                    placeholder="e.g. https://example.com/data"
                                    className="w-full px-4 py-2 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                                <p className="mt-1 text-xs text-muted-foreground">Link to supporting data or resolution criteria</p>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={clearDraft}
                                    disabled={Object.values(draft).every((v) => v === '')}
                                    className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Clear Draft
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
                            >
                                {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                                {isSubmitting ? getStageLabel(stage) : 'Create Market'}
                            </button>
                        </div>
                    </form>
                </div>
            </AuthGuard>
        </main>
    );
}