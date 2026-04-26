/**
 * Tests for the shared formatting utilities.
 * Covers currency, percentage, address, duration, and number formatting.
 */

import { describe, it, expect } from 'vitest';
import {
  stxToMicroStx,
  microStxToStx,
  formatStxAmount,
  formatStxAmountCompact,
  formatMicroStxValue,
  formatPercentage,
  formatRatioAsPercentage,
  formatAddress,
  formatStacksAddress,
  formatDuration,
  formatTimeRemaining,
  formatTimestamp,
  formatNumber,
  formatNumberCompact,
} from '../app/lib/formatting';

describe('Currency Formatting', () => {
  describe('stxToMicroStx', () => {
    it('converts STX to microSTX correctly', () => {
      expect(stxToMicroStx(1)).toBe(1_000_000);
      expect(stxToMicroStx(0.5)).toBe(500_000);
      expect(stxToMicroStx(10)).toBe(10_000_000);
    });

    it('floors decimal microSTX values', () => {
      expect(stxToMicroStx(0.0000001)).toBe(0);
      expect(stxToMicroStx(1.0000009)).toBe(1_000_000);
    });

    it('handles zero', () => {
      expect(stxToMicroStx(0)).toBe(0);
    });
  });

  describe('microStxToStx', () => {
    it('converts microSTX to STX correctly', () => {
      expect(microStxToStx(1_000_000)).toBe(1);
      expect(microStxToStx(500_000)).toBe(0.5);
      expect(microStxToStx(10_000_000)).toBe(10);
    });

    it('handles zero', () => {
      expect(microStxToStx(0)).toBe(0);
    });

    it('handles small values', () => {
      expect(microStxToStx(1)).toBe(0.000001);
      expect(microStxToStx(100)).toBe(0.0001);
    });
  });

  describe('formatStxAmount', () => {
    it('formats microSTX with STX suffix', () => {
      expect(formatStxAmount(1_000_000)).toBe('1.00 STX');
      expect(formatStxAmount(1_500_000)).toBe('1.50 STX');
    });

    it('uses locale-aware number formatting', () => {
      expect(formatStxAmount(1_234_567_890)).toBe('1,234.567890 STX');
      expect(formatStxAmount(100_000_000)).toBe('100.00 STX');
    });

    it('handles small values with up to 6 decimals', () => {
      expect(formatStxAmount(1)).toBe('0.000001 STX');
      expect(formatStxAmount(100)).toBe('0.000100 STX');
    });

    it('handles zero', () => {
      expect(formatStxAmount(0)).toBe('0.00 STX');
    });
  });

  describe('formatStxAmountCompact', () => {
    it('uses M suffix for millions', () => {
      expect(formatStxAmountCompact(1_500_000_000_000)).toBe('1.5M STX');
      expect(formatStxAmountCompact(2_000_000_000_000)).toBe('2.0M STX');
    });

    it('uses K suffix for thousands', () => {
      expect(formatStxAmountCompact(1_500_000_000)).toBe('1.5K STX');
      expect(formatStxAmountCompact(999_000_000)).toBe('999.0 STX');
    });

    it('shows full number for values under 1000 STX', () => {
      expect(formatStxAmountCompact(500_000_000)).toBe('500 STX');
      expect(formatStxAmountCompact(1_000_000)).toBe('1 STX');
    });

    it('handles small values with decimals', () => {
      expect(formatStxAmountCompact(500_000)).toBe('0.5 STX');
      expect(formatStxAmountCompact(1)).toBe('0.000001 STX');
    });
  });

  describe('formatMicroStxValue', () => {
    it('returns numeric value with 2 decimals', () => {
      expect(formatMicroStxValue(1_000_000)).toBe('1.00');
      expect(formatMicroStxValue(1_500_000)).toBe('1.50');
      expect(formatMicroStxValue(100_000)).toBe('0.10');
    });
  });
});

describe('Percentage Formatting', () => {
  describe('formatPercentage', () => {
    it('formats with default 1 decimal', () => {
      expect(formatPercentage(75)).toBe('75.0%');
      expect(formatPercentage(75.5)).toBe('75.5%');
    });

    it('formats with custom decimals', () => {
      expect(formatPercentage(75.567, 2)).toBe('75.57%');
      expect(formatPercentage(75, 0)).toBe('75%');
    });

    it('handles zero', () => {
      expect(formatPercentage(0)).toBe('0.0%');
    });

    it('handles values over 100', () => {
      expect(formatPercentage(150)).toBe('150.0%');
    });
  });

  describe('formatRatioAsPercentage', () => {
    it('calculates percentage from ratio', () => {
      expect(formatRatioAsPercentage(1, 2)).toBe('50.0%');
      expect(formatRatioAsPercentage(3, 4)).toBe('75.0%');
    });

    it('returns 0% for zero denominator', () => {
      expect(formatRatioAsPercentage(100, 0)).toBe('0%');
    });

    it('handles custom decimals', () => {
      expect(formatRatioAsPercentage(1, 3, 2)).toBe('33.33%');
    });
  });
});

describe('Address Formatting', () => {
  describe('formatAddress', () => {
    it('truncates with default settings', () => {
      expect(formatAddress('SP2WWKKF25SED3K5P6ETY7MDDNBQH50GPSP8EJM8N'))
        .toBe('SP2WWK...JM8N');
    });

    it('returns short addresses unchanged', () => {
      expect(formatAddress('SP1234')).toBe('SP1234');
      expect(formatAddress('')).toBe('');
    });

    it('uses custom options', () => {
      expect(formatAddress('SP2WWKKF25SED3K5P6ETY7MDDNBQH50GPSP8EJM8N', {
        startChars: 4,
        endChars: 4,
        separator: '..',
      })).toBe('SP2W..JM8N');
    });

    it('handles Ethereum addresses', () => {
      expect(formatAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'))
        .toBe('0x742d...0bEb');
    });
  });

  describe('formatStacksAddress', () => {
    it('uses canonical 6...4 truncation', () => {
      expect(formatStacksAddress('SP2WWKKF25SED3K5P6ETY7MDDNBQH50GPSP8EJM8N'))
        .toBe('SP2WWK...JM8N');
    });
  });
});

describe('Duration Formatting', () => {
  describe('formatDuration', () => {
    it('formats days, hours, minutes in full mode', () => {
      const ms = (2 * 24 * 60 * 60 * 1000) + (5 * 60 * 60 * 1000) + (30 * 60 * 1000);
      expect(formatDuration(ms)).toBe('2 days, 5 hours, 30 minutes');
    });

    it('formats in compact mode', () => {
      const ms = (2 * 24 * 60 * 60 * 1000) + (5 * 60 * 60 * 1000);
      expect(formatDuration(ms, { compact: true })).toBe('2d 5h');
    });

    it('includes seconds when enabled', () => {
      const ms = (5 * 60 * 1000) + (30 * 1000);
      expect(formatDuration(ms, { showSeconds: true })).toBe('5 minutes, 30 seconds');
    });

    it('excludes seconds when disabled', () => {
      const ms = (5 * 60 * 1000) + (30 * 1000);
      expect(formatDuration(ms, { showSeconds: false })).toBe('5 minutes');
    });

    it('omits seconds when days are present', () => {
      const ms = (2 * 24 * 60 * 60 * 1000) + (30 * 1000);
      expect(formatDuration(ms, { showSeconds: true })).toBe('2 days');
    });

    it('handles zero', () => {
      expect(formatDuration(0)).toBe('0 seconds');
      expect(formatDuration(0, { compact: true })).toBe('0s');
    });

    it('handles negative values', () => {
      expect(formatDuration(-1000)).toBe('0 seconds');
    });
  });

  describe('formatTimeRemaining', () => {
    it('shows hours and minutes remaining', () => {
      const now = Date.now();
      const deadline = now + (5 * 60 * 60 * 1000) + (30 * 60 * 1000);
      expect(formatTimeRemaining(deadline, now)).toBe('5h 30m remaining');
    });

    it('returns Expired when past deadline', () => {
      expect(formatTimeRemaining(1000, 2000)).toBe('Expired');
    });

    it('returns Loading when now is 0', () => {
      expect(formatTimeRemaining(Date.now(), 0)).toBe('Loading...');
    });
  });
});

describe('Timestamp Formatting', () => {
  describe('formatTimestamp', () => {
    const testDate = new Date('2025-06-15T10:30:00Z');
    const timestampMs = testDate.getTime();
    const timestampSec = Math.floor(timestampMs / 1000);

    it('formats in short mode', () => {
      expect(formatTimestamp(timestampMs, 'short')).toBe('Jun 15, 2025');
    });

    it('formats in long mode', () => {
      const result = formatTimestamp(timestampMs, 'long');
      expect(result).toContain('June');
      expect(result).toContain('2025');
      expect(result).toContain('10:30');
    });

    it('handles seconds timestamp', () => {
      expect(formatTimestamp(timestampSec, 'short')).toBe('Jun 15, 2025');
    });

    it('formats relative future time', () => {
      const future = Date.now() + (2 * 60 * 60 * 1000);
      expect(formatTimestamp(future, 'relative')).toBe('in 2h');
    });

    it('formats relative past time', () => {
      const past = Date.now() - (30 * 60 * 1000);
      expect(formatTimestamp(past, 'relative')).toBe('30m ago');
    });
  });
});

describe('Number Formatting', () => {
  describe('formatNumber', () => {
    it('formats with locale separators', () => {
      expect(formatNumber(1234567)).toBe('1,234,567');
      expect(formatNumber(1000)).toBe('1,000');
    });

    it('formats with decimal places', () => {
      expect(formatNumber(1234.567, 2)).toBe('1,234.57');
      expect(formatNumber(1234.5, 2)).toBe('1,234.50');
    });

    it('handles zero', () => {
      expect(formatNumber(0)).toBe('0');
    });
  });

  describe('formatNumberCompact', () => {
    it('uses T suffix for trillions', () => {
      expect(formatNumberCompact(1_500_000_000_000)).toBe('1.5T');
    });

    it('uses B suffix for billions', () => {
      expect(formatNumberCompact(2_500_000_000)).toBe('2.5B');
    });

    it('uses M suffix for millions', () => {
      expect(formatNumberCompact(1_500_000)).toBe('1.5M');
    });

    it('uses K suffix for thousands', () => {
      expect(formatNumberCompact(2_500)).toBe('2.5K');
    });

    it('shows full number under 1000', () => {
      expect(formatNumberCompact(999)).toBe('999.0');
      expect(formatNumberCompact(500)).toBe('500.0');
    });

    it('handles negative numbers', () => {
      expect(formatNumberCompact(-1_500_000)).toBe('-1.5M');
    });

    it('uses custom decimals', () => {
      expect(formatNumberCompact(1_500_000, 2)).toBe('1.50M');
    });
  });
});
