'use client';

import { FormEvent, useState } from 'react';
import { openContractCall } from '@stacks/connect';
import { stringAsciiCV, uintCV } from '@stacks/transactions';
import Navbar from '../components/Navbar';
import AuthGuard from '../components/AuthGuard';
import { useStacks } from '../components/StacksProvider';
import { useToast } from '../../providers/ToastProvider';
import { useLocalStorage } from '../lib/hooks/useLocalStorage';
import { validatePoolCreationForm } from '../lib/validators';
import { getRuntimeConfig } from '../lib/runtime-config';
import { Loader2 } from 'lucide-react';

const CREATE_MARKET_DRAFT_KEY = 'predinex_create_market_draft_v1';

interface CreateMarketDraft {
    title: string;
    description: string;
    outcomeA: string;
    outcomeB: string;
    duration: string;
}

const EMPTY_DRAFT: CreateMarketDraft = {
    title: '',
    description: '',
    outcomeA: '',
    outcomeB: '',
    duration: '',
};

type FormErrors = Partial<Record<keyof CreateMarketDraft, string>>;

export default function CreateMarket() {
    const { userData, authenticate } = useStacks();
    const { showToast } = useToast();
    const [draft, setDraft, clearDraft] = useLocalStorage<CreateMarketDraft>(
        CREATE_MARKET_DRAFT_KEY,
        EMPTY_DRAFT
    );
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [txId, setTxId] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setDraft((prev) => ({ ...prev, [name]: value }));
        if (errors[name as keyof CreateMarketDraft]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!userData) {
            authenticate();
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
            return;
        }

        setIsSubmitting(true);
        try {
            const { contract } = getRuntimeConfig();
            await openContractCall({
                contractAddress: contract.address,
                contractName: contract.name,
                functionName: 'create-pool',
                functionArgs: [
                    stringAsciiCV(draft.title),
                    stringAsciiCV(draft.description),
                    stringAsciiCV(draft.outcomeA),
                    stringAsciiCV(draft.outcomeB),
                    uintCV(duration),
                ],
                onFinish: (data) => {
                    setTxId(data.txId);
                    clearDraft();
                    showToast('Market created successfully!', 'success');
                    setIsSubmitting(false);
                },
                onCancel: () => {
                    showToast('Transaction cancelled.', 'info');
                    setIsSubmitting(false);
                },
            });
        } catch (error) {
            showToast(`Failed to create market: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <AuthGuard>
                <div className="container mx-auto px-4 py-12 max-w-2xl">
                    <h1 className="text-3xl font-bold mb-8">Create New Market</h1>

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
                                <label htmlFor="title" className="block text-sm font-medium mb-1">Question / Title</label>
                                <input
                                    id="title"
                                    name="title"
                                    type="text"
                                    value={draft.title}
                                    onChange={handleChange}
                                    placeholder="e.g. Will Bitcoin be above $100k by end of 2025?"
                                    className="w-full px-4 py-2 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    aria-describedby={errors.title ? 'title-error' : undefined}
                                    autoComplete="off"
                                />
                                {errors.title && <p id="title-error" role="alert" className="mt-1 text-sm text-red-500">{errors.title}</p>}
                                <p className="mt-1 text-xs text-muted-foreground">Draft saved locally and restored after refresh.</p>
                            </div>

                            {/* Description */}
                            <div>
                                <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
                                <textarea
                                    id="description"
                                    name="description"
                                    rows={3}
                                    value={draft.description}
                                    onChange={handleChange}
                                    placeholder="Provide context and resolution criteria for this market."
                                    className="w-full px-4 py-2 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                    aria-describedby={errors.description ? 'description-error' : undefined}
                                />
                                {errors.description && <p id="description-error" role="alert" className="mt-1 text-sm text-red-500">{errors.description}</p>}
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
                                        placeholder="e.g. Yes"
                                        className="w-full px-4 py-2 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        aria-describedby={errors.outcomeA ? 'outcomeA-error' : undefined}
                                    />
                                    {errors.outcomeA && <p id="outcomeA-error" role="alert" className="mt-1 text-sm text-red-500">{errors.outcomeA}</p>}
                                </div>
                                <div>
                                    <label htmlFor="outcomeB" className="block text-sm font-medium mb-1">Outcome B</label>
                                    <input
                                        id="outcomeB"
                                        name="outcomeB"
                                        type="text"
                                        value={draft.outcomeB}
                                        onChange={handleChange}
                                        placeholder="e.g. No"
                                        className="w-full px-4 py-2 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        aria-describedby={errors.outcomeB ? 'outcomeB-error' : undefined}
                                    />
                                    {errors.outcomeB && <p id="outcomeB-error" role="alert" className="mt-1 text-sm text-red-500">{errors.outcomeB}</p>}
                                </div>
                            </div>

                            {/* Duration */}
                            <div>
                                <label htmlFor="duration" className="block text-sm font-medium mb-1">Duration (blocks)</label>
                                <input
                                    id="duration"
                                    name="duration"
                                    type="number"
                                    min={10}
                                    value={draft.duration}
                                    onChange={handleChange}
                                    placeholder="e.g. 1440 (~10 days on Stacks)"
                                    className="w-full px-4 py-2 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    aria-describedby={errors.duration ? 'duration-error' : undefined}
                                />
                                {errors.duration && <p id="duration-error" role="alert" className="mt-1 text-sm text-red-500">{errors.duration}</p>}
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
                                {isSubmitting ? 'Submitting…' : 'Create Market'}
                            </button>
                        </div>
                    </form>
                </div>
            </AuthGuard>
        </main>
    );
}
