'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (`/sw.js`) once the page has loaded.
 *
 * Registration is skipped outside production so the cache-first strategy does
 * not interfere with the dev server's hot reloading.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('[pwa] Service worker registration failed:', error);
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
