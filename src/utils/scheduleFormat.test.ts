import { describe, expect, it } from 'vitest';
import { formatLastMet, formatUpcomingDay } from './scheduleFormat';

// Sunday 8 November 2026.
const NOW = new Date(2026, 10, 8, 12, 0);

describe('formatUpcomingDay', () => {
  it('names just the weekday within the coming week', () => {
    expect(formatUpcomingDay('2026-11-12', NOW)).toBe('Thursday');
  });

  it('adds the date once the weekday alone would be ambiguous', () => {
    expect(formatUpcomingDay('2026-11-19', NOW)).toBe('Thursday, Nov 19');
  });

  it('returns null for something that is not a date', () => {
    expect(formatUpcomingDay('soon', NOW)).toBeNull();
  });
});

describe('formatLastMet', () => {
  it('pairs a machine-readable local date with a readable label', () => {
    expect(formatLastMet(new Date(2026, 9, 28, 9, 30).toISOString())).toEqual({
      dateTime: '2026-10-28',
      label: 'Oct 28, 2026',
    });
  });

  it('returns null for an unreadable timestamp', () => {
    expect(formatLastMet('not a date')).toBeNull();
  });
});
