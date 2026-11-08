import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysBetween,
  dayOfMonth,
  formatDayRange,
  formatLongDay,
  formatMonthLabel,
  formatWeekLabel,
  formatWeekday,
  getMonthWeeks,
  getWeekDays,
  isSameMonth,
  startOfWeek,
} from './calendarDates';

describe('calendarDates', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('keeps the calendar day across a daylight saving change', () => {
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
  });

  it('clamps the day when adding months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('starts weeks on Monday, including for a Sunday', () => {
    expect(startOfWeek('2026-06-17')).toBe('2026-06-15');
    expect(startOfWeek('2026-06-15')).toBe('2026-06-15');
    expect(startOfWeek('2026-06-21')).toBe('2026-06-15');
    expect(getWeekDays('2026-06-17')).toHaveLength(7);
    expect(getWeekDays('2026-06-17')[6]).toBe('2026-06-21');
  });

  it('builds whole Monday to Sunday rows covering the month', () => {
    const june = getMonthWeeks('2026-06-10');
    expect(june).toHaveLength(5);
    expect(june[0][0]).toBe('2026-06-01');
    expect(june[4][6]).toBe('2026-07-05');
    // February 2027 starts on a Monday and has 28 days: exactly four rows.
    expect(getMonthWeeks('2027-02-10')).toHaveLength(4);
    // August 2026 needs six rows.
    expect(getMonthWeeks('2026-08-10')).toHaveLength(6);
  });

  it('compares months and measures days', () => {
    expect(isSameMonth('2026-06-01', '2026-06-30')).toBe(true);
    expect(isSameMonth('2026-06-30', '2026-07-01')).toBe(false);
    expect(daysBetween('2026-06-15', '2026-06-18')).toBe(3);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(dayOfMonth('2026-06-05')).toBe(5);
  });

  it('formats labels', () => {
    expect(formatLongDay('2026-11-09')).toBe('Monday, November 9');
    expect(formatWeekday('2026-11-09')).toBe('Mon');
    expect(formatMonthLabel('2026-11-09')).toBe('November 2026');
    expect(formatWeekLabel('2026-11-11')).toBe('Nov 9, 2026 to Nov 15, 2026');
  });

  it('formats ranges, adding the year only when asked or when it is not this year', () => {
    expect(formatDayRange('2026-06-15', '2026-06-15')).toBe('Jun 15');
    expect(formatDayRange('2026-06-15', '2026-06-17')).toBe('Jun 15 to Jun 17');
    expect(formatDayRange('2026-06-15', '2026-06-15', { withYear: true })).toBe('Jun 15, 2026');
    expect(formatDayRange('2026-06-15', '2026-06-17', { today: '2026-06-15' })).toBe(
      'Jun 15 to Jun 17',
    );
    expect(formatDayRange('2026-12-30', '2027-01-02', { today: '2026-12-30' })).toBe(
      'Dec 30, 2026 to Jan 2, 2027',
    );
  });

  it('throws for something that is not a calendar day', () => {
    expect(() => addDays('nope', 1)).toThrow(RangeError);
  });
});
