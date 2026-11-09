import { afterEach, describe, expect, it } from 'vitest';
import {
  daysUntilStart,
  formatStartDate,
  setActiveDateFormat,
  startOfStartDay,
  toDateAttribute,
} from './startDate';

const noon = new Date(2025, 5, 10, 12, 0, 0);

describe('daysUntilStart', () => {
  it('returns 0 for a date-only start on the same local day', () => {
    expect(daysUntilStart('2025-06-10', noon)).toBe(0);
  });

  it('returns 0 later in the same day regardless of the current time', () => {
    expect(daysUntilStart('2025-06-10', new Date(2025, 5, 10, 23, 59))).toBe(0);
  });

  it('counts whole calendar days ahead', () => {
    expect(daysUntilStart('2025-06-15', noon)).toBe(5);
  });

  it('returns a negative number once the start date has passed', () => {
    expect(daysUntilStart('2025-06-08', noon)).toBe(-2);
  });

  it('counts across a daylight saving change as whole days', () => {
    expect(daysUntilStart('2025-11-05', new Date(2025, 9, 30, 9, 0))).toBe(6);
  });

  it('uses the local day of a date-time start', () => {
    const local = new Date(2025, 5, 15, 9, 30).toISOString();

    expect(daysUntilStart(local, noon)).toBe(5);
  });
});

describe('toDateAttribute', () => {
  it('keeps a date-only value unchanged', () => {
    expect(toDateAttribute('2025-06-15')).toBe('2025-06-15');
  });

  it('formats the local day of a date-time value', () => {
    expect(toDateAttribute(new Date(2025, 0, 5, 18, 0).toISOString())).toBe('2025-01-05');
  });
});

describe('startOfStartDay', () => {
  it('returns local midnight', () => {
    const day = startOfStartDay('2025-06-15');

    expect([day.getHours(), day.getMinutes(), day.getDate()]).toEqual([0, 0, 15]);
  });
});

describe('formatStartDate', () => {
  afterEach(() => setActiveDateFormat('MM/DD/YYYY'));

  it('puts the month first by default and the day first for DD/MM/YYYY', () => {
    expect(formatStartDate('2023-03-13', 'MM/DD/YYYY')).toBe(
      new Date(2023, 2, 13).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    );
    expect(formatStartDate('2023-03-13', 'DD/MM/YYYY')).toBe('13 Mar 2023');
  });

  it('follows the active format when none is passed', () => {
    setActiveDateFormat('DD/MM/YYYY');

    expect(formatStartDate('2023-03-13')).toBe('13 Mar 2023');
  });

  it('returns null for a value that is not a date', () => {
    expect(formatStartDate('not a date')).toBeNull();
  });
});
