import { describe, expect, it } from 'vitest';
import { formatRelativeDate, isIsoDate } from './relativeDate';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

describe('formatRelativeDate', () => {
  it.each([
    [0, 'Updated today'],
    [1, 'Updated yesterday'],
    [3, 'Updated 3 days ago'],
    [7, 'Updated 1 week ago'],
    [20, 'Updated 2 weeks ago'],
    [30, 'Updated 1 month ago'],
    [70, 'Updated 2 months ago'],
    [364, 'Updated 12 months ago'],
    [365, 'Updated 1 year ago'],
    [800, 'Updated 2 years ago'],
  ])('%i days ago reads "%s"', (days, expected) => {
    expect(formatRelativeDate(daysAgo(days), NOW)).toBe(expected);
  });

  it('treats a date in the future as today', () => {
    expect(formatRelativeDate(daysAgo(-3), NOW)).toBe('Updated today');
  });

  it.each(['', 'garbage', '2025-13-45', '2025-02-30T99:00:00Z'])(
    'reads "Unknown date" for %j',
    (value) => {
      expect(formatRelativeDate(value, NOW)).toBe('Unknown date');
    },
  );
});

describe('isIsoDate', () => {
  it('accepts a date and a date-time and rejects other values', () => {
    expect(isIsoDate('2025-03-03')).toBe(true);
    expect(isIsoDate('2025-03-03T10:00:00.000Z')).toBe(true);
    expect(isIsoDate('03/03/2025')).toBe(false);
    expect(isIsoDate(20250303)).toBe(false);
  });
});
