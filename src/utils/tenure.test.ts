import { describe, expect, it } from 'vitest';
import { createMember } from '../test-utils/factories';
import {
  averageTenure,
  buildTenureBars,
  buildTenureScale,
  formatMonthYear,
  formatTenure,
  formatTenureShort,
  formatTenureSpoken,
  isTenureSortField,
  monthsBetween,
  sortTenureBars,
} from './tenure';

const NOW = new Date(2026, 10, 8);

describe('monthsBetween', () => {
  it('counts a month only once its day has come round', () => {
    expect(monthsBetween(new Date(2026, 0, 15), new Date(2026, 1, 14))).toBe(0);
    expect(monthsBetween(new Date(2026, 0, 15), new Date(2026, 1, 15))).toBe(1);
    expect(monthsBetween(new Date(2023, 2, 13), new Date(2026, 10, 8))).toBe(43);
  });

  it('never goes below zero', () => {
    expect(monthsBetween(new Date(2027, 0, 1), new Date(2026, 0, 1))).toBe(0);
  });
});

describe('tenure formatting', () => {
  it('formats years and months', () => {
    expect(formatTenure(28)).toBe('2y 4m');
    expect(formatTenure(24)).toBe('2y 0m');
    expect(formatTenure(7)).toBe('7m');
    expect(formatTenure(0)).toBe('0m');
    expect(formatTenureShort(28)).toBe('2yr 4mo');
    expect(formatTenureShort(7)).toBe('7mo');
    expect(formatTenureSpoken(0)).toBe('0 months');
  });

  it('formats a month and year, and leaves a bad date alone', () => {
    expect(formatMonthYear('2023-03-13')).toBe('Mar 2023');
    expect(formatMonthYear('nope')).toBe('nope');
  });

  it('only accepts the three sort fields', () => {
    expect(isTenureSortField('startDate')).toBe(true);
    expect(isTenureSortField('tenureLength')).toBe(true);
    expect(isTenureSortField('name')).toBe(true);
    expect(isTenureSortField('level')).toBe(false);
    expect(isTenureSortField(undefined)).toBe(false);
  });
});

describe('buildTenureBars', () => {
  it('runs active and new hire bars to today', () => {
    const [bar] = buildTenureBars(
      [createMember({ id: 'a', name: 'Alex', startDate: '2023-03-13' })],
      NOW,
    );

    expect(bar).toMatchObject({
      engineerId: 'a',
      name: 'Alex',
      startDate: '2023-03-13',
      endDate: '2026-11-08',
      status: 'active',
      tenureMonths: 43,
      tenureLabel: '3y 7m',
      startsInFuture: false,
      departureUnknown: false,
    });
  });

  it('ends a departing member at their expected departure', () => {
    const [bar] = buildTenureBars(
      [
        createMember({
          status: 'departing',
          startDate: '2024-01-10',
          departureDate: '2027-01-10',
        }),
      ],
      NOW,
    );

    expect(bar.endDate).toBe('2027-01-10');
    expect(bar.tenureMonths).toBe(36);
    expect(bar.departureUnknown).toBe(false);
  });

  it('falls back to today when a departing member has no usable departure date', () => {
    const bars = buildTenureBars(
      [
        createMember({ id: 'none', status: 'departing', startDate: '2024-01-10' }),
        createMember({
          id: 'bad',
          status: 'departing',
          startDate: '2024-01-10',
          departureDate: 'soon',
        }),
        createMember({
          id: 'early',
          status: 'departing',
          startDate: '2024-01-10',
          departureDate: '2023-01-01',
        }),
      ],
      NOW,
    );

    bars.forEach((bar) => {
      expect(bar.endDate).toBe('2026-11-08');
      expect(bar.departureUnknown).toBe(true);
    });
  });

  it('ignores a departure date on someone who is not departing', () => {
    const [bar] = buildTenureBars(
      [createMember({ startDate: '2024-01-10', departureDate: '2025-01-01' })],
      NOW,
    );

    expect(bar.endDate).toBe('2026-11-08');
  });

  it('gives a hire who has not started yet zero tenure', () => {
    const [bar] = buildTenureBars(
      [createMember({ status: 'new_hire', startDate: '2027-01-04' })],
      NOW,
    );

    expect(bar).toMatchObject({ startsInFuture: true, tenureMonths: 0, tenureLabel: '0m' });
  });

  it('skips members whose start date cannot be read', () => {
    const bars = buildTenureBars(
      [
        createMember({ id: 'ok', startDate: '2024-01-10' }),
        createMember({ id: 'bad', startDate: 'not a date' }),
        createMember({ id: 'empty', startDate: '' }),
      ],
      NOW,
    );

    expect(bars.map((bar) => bar.engineerId)).toEqual(['ok']);
  });
});

describe('sortTenureBars', () => {
  const bars = buildTenureBars(
    [
      createMember({ id: '1', name: 'bea', startDate: '2020-01-01' }),
      createMember({ id: '2', name: 'Alex', startDate: '2020-01-01' }),
      createMember({ id: '3', name: 'Cal', startDate: '2024-05-01' }),
    ],
    NOW,
  );

  it('breaks ties by name', () => {
    expect(sortTenureBars(bars, 'startDate').map((bar) => bar.name)).toEqual([
      'Alex',
      'bea',
      'Cal',
    ]);
    expect(sortTenureBars(bars, 'tenureLength').map((bar) => bar.name)).toEqual([
      'Alex',
      'bea',
      'Cal',
    ]);
  });

  it('sorts by name without regard to case and leaves the input alone', () => {
    const before = bars.map((bar) => bar.name);

    expect(sortTenureBars(bars, 'name').map((bar) => bar.name)).toEqual(['Alex', 'bea', 'Cal']);
    expect(bars.map((bar) => bar.name)).toEqual(before);
  });
});

describe('averageTenure', () => {
  it('averages to the nearest month and skips hires who have not started', () => {
    const bars = buildTenureBars(
      [
        createMember({ startDate: '2025-11-08' }),
        createMember({ startDate: '2024-11-08' }),
        createMember({ status: 'new_hire', startDate: '2027-01-04' }),
      ],
      NOW,
    );

    expect(averageTenure(bars)).toEqual({ months: 18, label: '1y 6m' });
  });

  it('is zero when nobody has started', () => {
    expect(averageTenure([])).toEqual({ months: 0, label: '0m' });
  });
});

describe('buildTenureScale', () => {
  it('spans whole years from the earliest start to the latest bar end', () => {
    const bars = buildTenureBars(
      [
        createMember({ startDate: '2019-04-01' }),
        createMember({ status: 'departing', startDate: '2022-01-01', departureDate: '2028-03-01' }),
      ],
      NOW,
    );

    expect(buildTenureScale(bars, NOW)).toEqual({
      minDate: '2019-01-01',
      maxDate: '2029-01-01',
      years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028],
    });
  });

  it('includes the start year of a hire who has not started yet', () => {
    const bars = buildTenureBars(
      [createMember({ status: 'new_hire', startDate: '2028-02-01' })],
      NOW,
    );

    expect(buildTenureScale(bars, NOW).years).toEqual([2026, 2027, 2028]);
  });

  it('shows this year when there are no bars', () => {
    expect(buildTenureScale([], NOW).years).toEqual([2026]);
  });
});
