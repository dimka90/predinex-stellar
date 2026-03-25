'use client';

import { useState } from 'react';
import { Share2, Link, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';

type FeedbackState = 'idle' | 'copied' | 'shared' | 'error';

interface ShareButtonProps {
  url?: string;
  title?: string;
  text?: string;
  className?: string;
}

/**
 * ShareButton - Provides copy-link and native share actions for a market page.
 * Falls back to copy-link when the Web Share API is unavailable (e.g. desktop).
 */
export default function ShareButton({ url, title, text, className }: ShareButtonProps) {
  const [feedback, setFeedbackState] = useState<FeedbackState>('idle');

  const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '');
  const canNativeShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ url: shareUrl });

  function showFeedback(state: FeedbackState) {
    setFeedbackState(state);
    setTimeout(() => setFeedbackState('idle'), 2500);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showFeedback('copied');
    } catch {
      showFeedback('error');
    }
  }

  async function handleShare() {
    try {
      await navigator.share({ url: shareUrl, title, text });
      showFeedback('shared');
    } catch (err) {
      // AbortError means the user dismissed the sheet — not a real error
      if (err instanceof Error && err.name !== 'AbortError') {
        showFeedback('error');
      }
    }
  }

  const feedbackLabel: Record<FeedbackState, string> = {
    idle: '',
    copied: 'Link copied!',
    shared: 'Shared!',
    error: 'Something went wrong',
  };

  const feedbackColor: Record<FeedbackState, string> = {
    idle: '',
    copied: 'text-green-400',
    shared: 'text-green-400',
    error: 'text-red-400',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Copy-link button — always visible */}
      <button
        onClick={handleCopy}
        aria-label="Copy market link to clipboard"
        title="Copy link"
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
          'bg-muted/60 hover:bg-muted border border-border hover:border-primary/40',
          'active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          feedback === 'copied' && 'border-green-500/40 bg-green-500/10'
        )}
      >
        {feedback === 'copied' ? (
          <Check className="w-3.5 h-3.5 text-green-400" aria-hidden="true" />
        ) : (
          <Link className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        <span className={cn(feedback === 'copied' ? 'text-green-400' : '')}>
          {feedback === 'copied' ? 'Copied!' : 'Copy link'}
        </span>
      </button>

      {/* Native share button — only rendered when the API is available */}
      {canNativeShare && (
        <button
          onClick={handleShare}
          aria-label="Share this market"
          title="Share"
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
            'bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary',
            'active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            feedback === 'shared' && 'border-green-500/40 bg-green-500/10 text-green-400'
          )}
        >
          {feedback === 'shared' ? (
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>{feedback === 'shared' ? 'Shared!' : 'Share'}</span>
        </button>
      )}

      {/* Error / success feedback label */}
      {feedback === 'error' && (
        <span
          role="alert"
          className={cn('text-xs font-medium flex items-center gap-1', feedbackColor[feedback])}
        >
          <X className="w-3 h-3" aria-hidden="true" />
          {feedbackLabel[feedback]}
        </span>
      )}
    </div>
  );
}
