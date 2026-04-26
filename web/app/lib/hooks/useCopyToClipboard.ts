import { useCallback, useEffect, useRef, useState } from 'react';

/** Matches common UI feedback duration for copy actions (nav, CopyButton, etc.). */
export const COPY_FEEDBACK_MS = 2000;

export type CopyStatus = 'idle' | 'copied' | 'error';

export function useCopyToClipboard() {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus('idle'), COPY_FEEDBACK_MS);
    } catch {
      setStatus('error');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus('idle'), COPY_FEEDBACK_MS);
    }
  }, []);

  return {
    copy,
    status,
    isCopied: status === 'copied',
    isError: status === 'error',
  };
}
