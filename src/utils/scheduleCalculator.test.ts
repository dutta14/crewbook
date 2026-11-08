import { describe, expect, it } from 'vitest';
import type { Schedule } from '../types/Schedule';
import { createMember } from '../test-utils/factories';
import {
  applyScheduleEdit,
  calculateNextDate,
  getNextUpcoming,
  getTodaysOneOnes,
  isOverdue,
  parseIsoDate,
  reschedule,
  skipNext,
  toIsoDate,
  type ScheduleDraft,
} from './scheduleCalculator';

// Sunday 8 November 2026, noon.
const NOW = new Date(2026, 10, 8, 12, 0);

const draft = (overrides: Partial<ScheduleDraft> = {}): ScheduleDraft => ({
  cadence: 'weekly',
  dayOfWeek: 'tuesday',
  time: '10:00',
  ...overrides,
});

const schedule = (overrides: Partial<Schedule> = {}): Schedule => ({
  ...draft(),
  nextDate: '2026-11-10',
  ...overrides,
});

describe('calculateNextDate', () => {
  it('calculates next weekly 1:1 correctly', () => {
    expect(calculateNextDate(draft(), NOW)).toBe('2026-11-10');
  });

  it('uses today when the meeting time is still ahead, and next week once it has passed', () => {
    const tuesdayMorning = new Date(2026, 10, 10, 9, 0);
    const tuesdayAfternoon = new Date(2026, 10, 10, 11, 0);

    expect(calculateNextDate(draft(), tuesdayMorning)).toBe('2026-11-10');
    expect(calculateNextDate(draft(), tuesdayAfternoon)).toBe('2026-11-17');
  });

  it('calculates next biweekly 1:1 correctly', () => {
    const biweekly = schedule({ cadence: 'biweekly' });

    expect(calculateNextDate(biweekly, NOW)).toBe('2026-11-10');
    expect(skipNext(biweekly, NOW).nextDate).toBe('2026-11-24');
  });

  it('calculates next monthly 1:1 correctly', () => {
    const monthly = schedule({ cadence: 'monthly' });

    // The second Tuesday of November is followed by the second Tuesday of December.
    expect(skipNext(monthly, NOW).nextDate).toBe('2026-12-08');
  });

  it('keeps a fifth weekday in the last week of shorter months', () => {
    const monthly = schedule({ cadence: 'monthly', nextDate: '2026-03-31' });

    expect(skipNext(monthly, new Date(2026, 2, 1)).nextDate).toBe('2026-04-28');
  });

  it('custom interval calculates correctly', () => {
    const custom = schedule({ cadence: 'custom', customIntervalDays: 10 });

    // Ten days after Tuesday the 10th is a Friday, so the next Tuesday on or after it is the 24th.
    expect(skipNext(custom, NOW).nextDate).toBe('2026-11-24');
  });

  it('handles daylight saving changes without drifting a day', () => {
    const weekly = schedule({ nextDate: '2026-10-27' });

    expect(skipNext(weekly, new Date(2026, 9, 20)).nextDate).toBe('2026-11-03');
  });
});

describe('isOverdue', () => {
  it('detects overdue when next date is in the past', () => {
    expect(isOverdue('2026-11-07', NOW)).toBe(true);
  });

  it('is not overdue today or later, and ignores values that are not dates', () => {
    expect(isOverdue('2026-11-08', NOW)).toBe(false);
    expect(isOverdue('2026-11-10', NOW)).toBe(false);
    expect(isOverdue('not a date', NOW)).toBe(false);
  });
});

describe('skipNext', () => {
  it('skip advances to the following occurrence', () => {
    expect(skipNext(schedule(), NOW).nextDate).toBe('2026-11-17');
  });

  it('keeps advancing past an overdue date so the result is not overdue', () => {
    const skipped = skipNext(schedule({ nextDate: '2026-10-06' }), NOW);

    expect(skipped.nextDate).toBe('2026-11-10');
    expect(isOverdue(skipped.nextDate, NOW)).toBe(false);
  });

  it('clears a one-time override and does not mutate its input', () => {
    const original = schedule({ nextDate: '2026-11-12', overrideDate: '2026-11-12' });
    const skipped = skipNext(original, NOW);

    expect(skipped.nextDate).toBe('2026-11-17');
    expect(skipped).not.toHaveProperty('overrideDate');
    expect(original.overrideDate).toBe('2026-11-12');
  });

  it('recovers from a stored date that cannot be read', () => {
    expect(skipNext(schedule({ nextDate: 'garbage' }), NOW).nextDate).toBe('2026-11-10');
  });
});

describe('reschedule', () => {
  it('reschedule overrides next date only', () => {
    const moved = reschedule(schedule(), '2026-11-12');

    expect(moved).toMatchObject({
      cadence: 'weekly',
      dayOfWeek: 'tuesday',
      time: '10:00',
      nextDate: '2026-11-12',
      overrideDate: '2026-11-12',
    });
    // The recurring pattern resumes after the moved occurrence.
    expect(skipNext(moved, NOW).nextDate).toBe('2026-11-17');
  });

  it('rejects dates that do not exist', () => {
    expect(() => reschedule(schedule(), '2026-02-30')).toThrow(RangeError);
    expect(() => reschedule(schedule(), '11/12/2026')).toThrow(RangeError);
  });
});

describe('applyScheduleEdit', () => {
  it('changing cadence recalculates next date', () => {
    const previous = schedule({ nextDate: '2026-11-17' });

    const edited = applyScheduleEdit(
      previous,
      draft({ cadence: 'biweekly', dayOfWeek: 'thursday' }),
      NOW,
    );

    expect(edited).toMatchObject({
      cadence: 'biweekly',
      dayOfWeek: 'thursday',
      nextDate: '2026-11-12',
    });
    expect(edited).not.toHaveProperty('overrideDate');
  });

  it('changing only the time keeps the next date and a one-time override', () => {
    const previous = schedule({ nextDate: '2026-11-12', overrideDate: '2026-11-12' });

    expect(applyScheduleEdit(previous, draft({ time: '14:30' }), NOW)).toEqual({
      ...previous,
      time: '14:30',
    });
  });

  it('recalculates forward when the kept next date is already past', () => {
    const previous = schedule({ nextDate: '2026-10-06' });

    expect(applyScheduleEdit(previous, draft({ time: '11:00' }), NOW).nextDate).toBe('2026-11-10');
  });

  it('creates a schedule from nothing and only keeps the interval for custom cadence', () => {
    const custom = applyScheduleEdit(
      null,
      draft({ cadence: 'custom', customIntervalDays: 21 }),
      NOW,
    );
    const weekly = applyScheduleEdit(null, draft({ customIntervalDays: 21 }), NOW);

    expect(custom).toMatchObject({ customIntervalDays: 21, nextDate: '2026-11-10' });
    expect(weekly).not.toHaveProperty('customIntervalDays');
  });
});

describe('date parsing', () => {
  it('only accepts real calendar dates in YYYY-MM-DD form', () => {
    expect(parseIsoDate('2026-02-29')).toBeNull();
    expect(parseIsoDate('2026-2-9')).toBeNull();
    expect(parseIsoDate('2026-11-09T00:00:00Z')).toBeNull();
    expect(toIsoDate(parseIsoDate('2028-02-29') as Date)).toBe('2028-02-29');
  });
});

describe('getTodaysOneOnes', () => {
  const scheduled = (name: string, nextDate: string, time = '10:00') =>
    createMember({ name, schedule: schedule({ nextDate, time }) });

  it('lists members whose next 1:1 is today, earliest time first, with their counts', () => {
    const late = scheduled('Late', '2026-11-08', '15:30');
    const early = scheduled('Early', '2026-11-08', '09:00');
    const tomorrow = scheduled('Tomorrow', '2026-11-09');
    const overdue = scheduled('Overdue', '2026-11-03');

    const entries = getTodaysOneOnes([late, tomorrow, early, overdue], {
      now: NOW,
      openActionItems: new Map([[early.id, 2]]),
      lastMetDates: new Map([[late.id, '2026-10-27T10:00:00.000Z']]),
    });

    expect(entries).toEqual([
      { memberId: early.id, name: 'Early', time: '09:00', openActionItems: 2, lastMetDate: null },
      {
        memberId: late.id,
        name: 'Late',
        time: '15:30',
        openActionItems: 0,
        lastMetDate: '2026-10-27T10:00:00.000Z',
      },
    ]);
  });

  it('breaks time ties by name and skips members with missing or damaged schedules', () => {
    const zed = scheduled('Zed', '2026-11-08');
    const amy = scheduled('Amy', '2026-11-08');
    const noSchedule = createMember({ name: 'None' });
    const badTime = createMember({
      name: 'Bad time',
      schedule: schedule({ nextDate: '2026-11-08', time: '25:99' }),
    });
    const badDate = createMember({ name: 'Bad date', schedule: schedule({ nextDate: 'soon' }) });

    const names = getTodaysOneOnes([zed, noSchedule, badTime, badDate, amy], { now: NOW }).map(
      (entry) => entry.name,
    );

    expect(names).toEqual(['Amy', 'Zed']);
  });
});

describe('getNextUpcoming', () => {
  it('returns the soonest 1:1 after today, ignoring today and the past', () => {
    const members = [
      createMember({ name: 'Today', schedule: schedule({ nextDate: '2026-11-08' }) }),
      createMember({ name: 'Past', schedule: schedule({ nextDate: '2026-11-02' }) }),
      createMember({ name: 'Later', schedule: schedule({ nextDate: '2026-11-17' }) }),
      createMember({ name: 'Soon', schedule: schedule({ nextDate: '2026-11-10', time: '11:00' }) }),
      createMember({ name: 'Soonest', schedule: schedule({ nextDate: '2026-11-10' }) }),
    ];

    expect(getNextUpcoming(members, NOW)).toEqual({ name: 'Soonest', date: '2026-11-10' });
  });

  it('returns null when nobody has an upcoming 1:1', () => {
    expect(getNextUpcoming([createMember()], NOW)).toBeNull();
    expect(getNextUpcoming([], NOW)).toBeNull();
  });
});
