'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';

const STORAGE_KEY = 'predinex_push_notifications_v1';

export type BrowserNotificationPermission = 'default' | 'granted' | 'denied';

export interface BrowserNotificationOptions {
  body?: string;
  tag?: string;
  icon?: string;
}

function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function getPermission(): BrowserNotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return window.Notification.permission as BrowserNotificationPermission;
}

export function isBrowserNotificationEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === 'true';
}

export function setBrowserNotificationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function notifyBrowserEvent(title: string, options: BrowserNotificationOptions = {}): boolean {
  if (!isNotificationSupported() || !isBrowserNotificationEnabled() || getPermission() !== 'granted') {
    return false;
  }

  new window.Notification(title, options);
  return true;
}

export function useBrowserNotifications() {
  const [enabled, setEnabledState, clearEnabled] = useLocalStorage<boolean>(STORAGE_KEY, false);
  const [permission, setPermission] = useState<BrowserNotificationPermission>('default');

  useEffect(() => {
    setPermission(getPermission());
  }, []);

  const requestPermission = async () => {
    if (!isNotificationSupported()) {
      return 'denied' as const;
    }

    const nextPermission = (await window.Notification.requestPermission()) as BrowserNotificationPermission;
    setPermission(nextPermission);
    if (nextPermission === 'granted') {
      setEnabledState(true);
    }
    return nextPermission;
  };

  const disable = () => {
    clearEnabled();
    setPermission(getPermission());
  };

  const sendTestNotification = async () => {
    const nextPermission = permission === 'granted' ? permission : await requestPermission();
    if (nextPermission === 'granted') {
      notifyBrowserEvent('Predinex alerts are enabled', {
        body: 'You will receive browser notifications for important market events.',
        tag: 'predinex-test-notification',
      });
    }
  };

  return useMemo(
    () => ({
      enabled,
      permission,
      setEnabled: (nextEnabled: boolean) => {
        setEnabledState(nextEnabled);
        if (nextEnabled && permission !== 'granted') {
          void requestPermission();
        }
      },
      requestPermission,
      disable,
      sendTestNotification,
    }),
    [disable, enabled, permission, requestPermission, sendTestNotification, setEnabledState],
  );
}
