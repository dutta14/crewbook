import { describe, expect, it } from 'vitest';
import {
  CLOCK_SKEW_MS,
  DEFAULT_SHARE_TTL,
  MAX_SHARE_TTL_MS,
  describeTimeLeft,
  isBeyondMaxLifetime,
  isExpiringSoon,
  isPastExpiry,
  isShareTokenTTL,
  ttlForLifetime,
  ttlToMs,
} from './shareExpiry';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-03-01T10:00:00.000Z');
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe('shareExpiry', () => {
  it('defaults to 24 hours and caps links at 48', () => {
    expect(DEFAULT_SHARE_TTL).toBe('24h');
    expect(MAX_SHARE_TTL_MS).toBe(48 * HOUR);
  });

  it('knows only the four preset lifetimes', () => {
    expect(['1h', '6h', '24h', '48h'].every(isShareTokenTTL)).toBe(true);
    expect(isShareTokenTTL('72h')).toBe(false);
    expect(isShareTokenTTL('toString')).toBe(false);
    expect(ttlToMs('6h')).toBe(6 * HOUR);
    expect(ttlForLifetime(HOUR)).toBe('1h');
    expect(ttlForLifetime(HOUR + 1)).toBeNull();
  });

  it('treats a link as expired only after the clock tolerance has passed', () => {
    expect(isPastExpiry(at(1), NOW)).toBe(false);
    expect(isPastExpiry(at(0), NOW)).toBe(false);
    expect(isPastExpiry(at(-CLOCK_SKEW_MS + 1), NOW)).toBe(false);
    expect(isPastExpiry(at(-CLOCK_SKEW_MS), NOW)).toBe(true);
  });

  it('flags an expiry further out than any link the app makes', () => {
    expect(isBeyondMaxLifetime(at(MAX_SHARE_TTL_MS), NOW)).toBe(false);
    expect(isBeyondMaxLifetime(at(MAX_SHARE_TTL_MS + CLOCK_SKEW_MS + 1), NOW)).toBe(true);
  });

  it('flags the last hour as urgent', () => {
    expect(isExpiringSoon(at(HOUR - 1), NOW)).toBe(true);
    expect(isExpiringSoon(at(HOUR), NOW)).toBe(false);
  });

  it.each([
    [-5000, 'less than a minute'],
    [20_000, 'less than a minute'],
    [60_000, '1 minute'],
    [12 * 60_000 - 1, '12 minutes'],
    [59 * 60_000, '59 minutes'],
    [HOUR, '1 hour'],
    [3 * HOUR, '3 hours'],
    [47 * HOUR + 40 * 60_000, '48 hours'],
  ])('describes %i ms left as %s', (offset, expected) => {
    expect(describeTimeLeft(at(offset), NOW)).toBe(expected);
  });
});
