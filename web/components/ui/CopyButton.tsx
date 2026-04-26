import { Copy, Check } from 'lucide-react';
import { ICON_CLASS } from '../../app/lib/constants';
import { useCopyToClipboard } from '../../app/lib/hooks/useCopyToClipboard';

interface CopyButtonProps {
    value: string;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

/**
 * CopyButton - Specialized button for copying text to clipboard
 * @param value The text to copy
 * @param className Additional CSS classes
 * @param size Size of the icon
 */
export default function CopyButton({
    value,
    className = '',
    size = 'sm'
}: CopyButtonProps) {
    const { copy, status, isCopied, isError } = useCopyToClipboard();

    const handleCopy = () => {
        void copy(value);
    };

    const Icon = isCopied ? Check : Copy;
    const iconClass = size === 'sm' ? ICON_CLASS.sm : size === 'md' ? ICON_CLASS.md : ICON_CLASS.lg;

    const title =
        isCopied ? 'Copied!' : isError ? 'Copy failed — click to retry' : 'Copy to clipboard';
    const ariaLabel =
        isCopied ? 'Copied to clipboard' : isError ? 'Copy failed, click to try again' : 'Copy to clipboard';

    return (
        <div className="inline-flex flex-col items-center">
            <button
                type="button"
                onClick={handleCopy}
                className={`p-2 hover:bg-muted rounded-lg transition-all active:scale-90 relative ${className} ${isCopied ? 'text-green-500' : isError ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}
                title={title}
                aria-label={ariaLabel}
            >
                <Icon className={iconClass} />
            </button>
            <span className="sr-only" aria-live="polite">
                {status === 'copied' && 'Copied to clipboard.'}
                {status === 'error' && 'Copy failed. Try again.'}
            </span>
        </div>
    );
}
