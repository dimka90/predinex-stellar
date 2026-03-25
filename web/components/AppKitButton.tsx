'use client';

import { useAppKit } from '../lib/hooks/useAppKit';
import { Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AppKitButtonProps {
  className?: string;
  label?: string;
}

export default function AppKitButton({ className, label = 'Connect Wallet' }: AppKitButtonProps) {
  const { open, isConnected, address } = useAppKit();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <button 
        className={`flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-full border border-primary/20 transition-colors font-medium text-sm ${className}`}
        disabled
      >
        <Wallet className="w-4 h-4" />
        Loading...
      </button>
    );
  }

  return (
    <>
      {!isConnected ? (
        <button
          onClick={() => open()}
          className={`flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-full border border-primary/20 transition-colors font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${className}`}
        >
          <Wallet className="w-4 h-4" />
          {label}
        </button>
      ) : (
        <w3m-button />
      )}
    </>
  );
}
