import { describe, expect, it } from 'vitest';
import { formatBriefingDate, getGreeting } from './briefingFormat';

describe('getGreeting', () => {
  it.each([
    [0, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [17, 'Good afternoon'],
    [18, 'Good evening'],
    [23, 'Good evening'],
  ])('at %i:00 says %s', (hour, greeting) => {
    expect(getGreeting(new Date(2026, 5, 15, hour))).toBe(greeting);
  });
});

describe('formatBriefingDate', () => {
  it('spells out the weekday, month, day and year', () => {
    expect(formatBriefingDate(new Date(2025, 0, 14, 8))).toMatch(
      /Tuesday,? January 14,? 2025|Tuesday, 14 January 2025/,
    );
  });
});
