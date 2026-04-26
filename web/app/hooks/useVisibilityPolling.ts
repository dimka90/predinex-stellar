'use client';

// #239 — back off polling when the tab is hidden or the window loses focus.
// Drop-in replacement for a plain setInterval: callers pass a callback and an
// interval and get automatic pause/resume tied to the Page Visibility API.

import { useEffect, useRef, useCallback } from 'react';

/**
 * Runs `callback` immediately, then on every `intervalMs` while the document
 * is visible and the window is focused. Pauses automatically when the user
 * switches tabs or minimises the browser; resumes the moment they return.
 *
 * @param callback  The async-safe fetch/refresh function to repeat.
 * @param intervalMs  Polling cadence while the tab is visible (default 30 s).
 * @param enabled  Set to false to skip polling entirely (e.g. wallet disconnected).
 */
export function useVisibilityPolling(
  callback: () => void,
  intervalMs = 30_000,
  enabled = true,
): void {
  const savedCallback = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const start = useCallback(() => {
    if (timerRef.current !== null) return;
    savedCallback.current();
    timerRef.current = setInterval(() => savedCallback.current(), intervalMs);
  }, [intervalMs]);

  const stop = useCallback(() => {
    if (timerRef.current === null) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };

    const handleFocus = () => start();
    const handleBlur = () => stop();

    // Kick off immediately if the tab is already visible.
    if (!document.hidden) start();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, start, stop]);
}
