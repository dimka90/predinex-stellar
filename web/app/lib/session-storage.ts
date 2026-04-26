/**
 * Session Storage Service
 * Secure session persistence for wallet connections
 */

import { WalletSession } from './wallet-service';

export interface StoredSession {
  session: WalletSession;
  timestamp: number;
  version: string;
}

export class SessionStorageService {
  private static readonly STORAGE_KEY = 'predinex_wallet_session';
  private static readonly STORAGE_VERSION = '1.0.0';
  private static readonly SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Store wallet session securely
   */
  static storeSession(session: WalletSession): void {
    try {
      const storedSession: StoredSession = {
        session,
        timestamp: Date.now(),
        version: this.STORAGE_VERSION,
      };

      const encrypted = this.encryptData(JSON.stringify(storedSession));
      localStorage.setItem(this.STORAGE_KEY, encrypted);
    } catch (error) {
      console.error('Failed to store session:', error);
      throw new Error('Session storage failed');
    }
  }

  /**
   * Retrieve wallet session
   */
  static retrieveSession(): WalletSession | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const decrypted = this.decryptData(stored);
      const storedSession: StoredSession = JSON.parse(decrypted);

      // Check version compatibility
      if (storedSession.version !== this.STORAGE_VERSION) {
        this.clearSession();
        return null;
      }

      // Check expiration
      if (Date.now() - storedSession.timestamp > this.SESSION_TTL) {
        this.clearSession();
        return null;
      }

      // Validate session structure
      if (!this.isValidSession(storedSession.session)) {
        this.clearSession();
        return null;
      }

      return {
        ...storedSession.session,
        connectedAt: new Date(storedSession.session.connectedAt),
        lastActivity: new Date(storedSession.session.lastActivity),
      };
    } catch (error) {
      console.error('Failed to retrieve session:', error);
      this.clearSession();
      return null;
    }
  }

  /**
   * Clear stored session
   */
  static clearSession(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }

  /**
   * Update session activity timestamp
   */
  static updateActivity(session: WalletSession): void {
    const updatedSession = {
      ...session,
      lastActivity: new Date(),
    };
    this.storeSession(updatedSession);
  }

  /**
   * Check if session exists
   */
  static hasStoredSession(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }

  /**
   * Validate session structure
   */
  private static isValidSession(session: unknown): session is WalletSession {
    return (
      session &&
      typeof (session as any).address === 'string' &&
      typeof (session as any).publicKey === 'string' &&
      typeof (session as any).network === 'string' &&
      typeof (session as any).balance === 'number' &&
      typeof (session as any).isConnected === 'boolean' &&
      typeof (session as any).walletType === 'string' &&
      (session as any).connectedAt &&
      (session as any).lastActivity
    );
  }

  /**
   * Simple encryption for session data
   * Note: This is basic obfuscation, not cryptographically secure
   */
  private static encryptData(data: string): string {
    // Simple base64 encoding with rotation
    const encoded = btoa(data);
    return encoded.split('').reverse().join('');
  }

  /**
   * Simple decryption for session data
   */
  private static decryptData(data: string): string {
    // Reverse the rotation and decode
    const reversed = data.split('').reverse().join('');
    return atob(reversed);
  }

  /**
   * Get storage usage info
   */
  static getStorageInfo(): { used: number; available: number } {
    try {
      const testKey = 'storage_test';
      const testValue = 'x'.repeat(1024); // 1KB
      let used = 0;
      let available = 0;

      // Estimate used space
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }

      // Estimate available space
      try {
        let i = 0;
        while (i < 10000) { // Max 10MB test
          localStorage.setItem(testKey + i, testValue);
          available += testValue.length;
          i++;
        }
      } catch (_e) {
        // Storage full
      } finally {
        // Clean up test data
        let i = 0;
        while (localStorage.getItem(testKey + i)) {
          localStorage.removeItem(testKey + i);
          i++;
        }
      }

      return { used, available };
    } catch (_error) {
      return { used: 0, available: 0 };
    }
  }
}