import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
    message: string;
    type?: ToastType;
    duration?: number;
    onClose: () => void;
}

/**
 * Toast - Ephemeral notification component
 * @param message The notification message
 * @param type The type of notification (success, error, info, warning)
 * @param duration How long to show the toast in ms
 * @param onClose Callback when toast is closed
 */
export default function Toast({
    message,
    type = 'info',
    duration = 5000,
    onClose
}: ToastProps) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300); // Wait for fade-out animation
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-500" />,
        error: <AlertCircle className="w-5 h-5 text-red-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    };

    const bgClasses = {
        success: 'bg-green-500/10 border-green-500/20',
        error: 'bg-red-500/10 border-red-500/20',
        info: 'bg-blue-500/10 border-blue-500/20',
        warning: 'bg-amber-500/10 border-amber-500/20',
    };

    return (
        <div className={`fixed bottom-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border glass shadow-2xl transition-all duration-300 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'} ${bgClasses[type]}`}>
            {icons[type]}
            <p className="text-sm font-medium">{message}</p>
            <button
                onClick={() => {
                    setIsVisible(false);
                    setTimeout(onClose, 300);
                }}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
                <X className="w-4 h-4 text-muted-foreground" />
            </button>
        </div>
    );
}
