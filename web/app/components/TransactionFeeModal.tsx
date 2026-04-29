'use client';

import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { stroopsToXlm } from '../lib/formatting';

interface TransactionFeeModalProps {
  isOpen: boolean;
  actionName: string;
  feeStroops: string | number;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

export function TransactionFeeModal({
  isOpen,
  actionName,
  feeStroops,
  onConfirm,
  onCancel,
  isConfirming = false,
}: TransactionFeeModalProps) {
  if (!isOpen) return null;

  // Assume formatting function exists or implement directly if not
  const feeXlm = stroopsToXlm ? stroopsToXlm(Number(feeStroops)) : (Number(feeStroops) / 10_000_000).toFixed(7);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Confirm Transaction</h2>
          <p className="text-muted-foreground mb-6">
            You are about to execute: <strong className="text-foreground">{actionName}</strong>
          </p>

          <div className="bg-muted/50 p-4 rounded-xl border border-border mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-muted-foreground">Estimated Network Fee</span>
              <span className="font-bold text-foreground">{feeXlm} XLM</span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              This fee is required by the Stellar network to process your transaction.
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              disabled={isConfirming}
              className="flex-1 px-4 py-3 rounded-xl border border-border hover:bg-muted font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isConfirming}
              className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:brightness-110 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isConfirming && <Loader2 className="w-4 h-4 animate-spin" />}
              {isConfirming ? 'Confirming...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
