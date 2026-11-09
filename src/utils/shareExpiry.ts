import type { ShareTokenTTL } from '../types/sharing';

const HOUR_MS = 60 * 60 * 1000;

export const SHARE_TTL_OPTIONS: readonly { value: ShareTokenTTL; label: string }[] = [
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '24h', label: '24 hours' },
  { value: '48h', label: '48 hours' },
];

export const DEFAULT_SHARE_TTL: ShareTokenTTL = '24h';

const TTL_MS: Record<ShareTokenTTL, number> = {
  '1h': HOUR_MS,
  '6h': 6 * HOUR_MS,
  '24h': 24 * HOUR_MS,
  '48h': 48 * HOUR_MS,
};

/** No link may live longer than this, whatever a payload claims. */
export const MAX_SHARE_TTL_MS = TTL_MS['48h'];

/** Tolerance for two clocks that disagree a little. Anything larger counts as a real difference. */
export const CLOCK_SKEW_MS = 30_000;

export function isShareTokenTTL(value: unknown): value is ShareTokenTTL {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TTL_MS, value);
}

export function ttlToMs(ttl: ShareTokenTTL): number {
  return TTL_MS[ttl];
}

/** The preset a lifetime in milliseconds belongs to, or null for any other length. */
export function ttlForLifetime(lifetimeMs: number): ShareTokenTTL | null {
  const match = SHARE_TTL_OPTIONS.find(({ value }) => TTL_MS[value] === lifetimeMs);
  return match ? match.value : null;
}

export function msUntil(expiresAt: string, now: number = Date.now()): number {
  return Date.parse(expiresAt) - now;
}

/** True once the link is past its expiry, allowing for a small difference between clocks. */
export function isPastExpiry(expiresAt: string, now: number = Date.now()): boolean {
  return msUntil(expiresAt, now) + CLOCK_SKEW_MS <= 0;
}

/** True when the expiry is further away than any link this app creates. */
export function isBeyondMaxLifetime(expiresAt: string, now: number = Date.now()): boolean {
  return msUntil(expiresAt, now) > MAX_SHARE_TTL_MS + CLOCK_SKEW_MS;
}

/** Under an hour left. The point where a countdown starts to look urgent. */
export function isExpiringSoon(expiresAt: string, now: number = Date.now()): boolean {
  return msUntil(expiresAt, now) < HOUR_MS;
}

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`;

/** "3 hours", "12 minutes". Rounded to whole minutes or hours because the UI has no seconds. */
export function describeTimeLeft(expiresAt: string, now: number = Date.now()): string {
  const remaining = msUntil(expiresAt, now);
  if (remaining < 60_000) return 'less than a minute';
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes < 60) return plural(minutes, 'minute');
  return plural(Math.max(1, Math.round(minutes / 60)), 'hour');
}
