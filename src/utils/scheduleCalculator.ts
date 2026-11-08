import type { Cadence, DayOfWeek, Schedule } from '../types/Schedule';

export const CADENCES: readonly Cadence[] = ['weekly', 'biweekly', 'monthly', 'custom'];
export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];
export const MAX_CUSTOM_INTERVAL_DAYS = 365;

export type ScheduleDraft = Omit<Schedule, 'nextDate' | 'overrideDate'>;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WEEKDAY_INDEX: Record<DayOfWeek, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
};

export const isCadence = (value: unknown): value is Cadence =>
  typeof value === 'string' && (CADENCES as readonly string[]).includes(value);

export const isDayOfWeek = (value: unknown): value is DayOfWeek =>
  typeof value === 'string' && (DAYS_OF_WEEK as readonly string[]).includes(value);

export const isValidTime = (value: unknown): value is string =>
  typeof value === 'string' && TIME.test(value);

export const isValidInterval = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= MAX_CUSTOM_INTERVAL_DAYS;

/** Strictly parses YYYY-MM-DD into local midnight; never hands the string to Date's own parser. */
export function parseIsoDate(value: string): Date | null {
  const match = typeof value === 'string' ? ISO_DATE.exec(value) : null;
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const isRealDay =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isRealDay ? date : null;
}

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${month}-${day}`;
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
// Calendar arithmetic rather than milliseconds, so daylight saving changes never shift the day.
const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

function firstWeekdayOnOrAfter(from: Date, dayOfWeek: DayOfWeek): Date {
  const offset = (WEEKDAY_INDEX[dayOfWeek] - from.getDay() + 7) % 7;
  return addDays(from, offset);
}

/** The `ordinal`-th weekday of the month, or the last one when the month has fewer. */
function nthWeekdayOfMonth(year: number, month: number, dayOfWeek: DayOfWeek, ordinal: number) {
  const candidate = addDays(
    firstWeekdayOnOrAfter(new Date(year, month, 1), dayOfWeek),
    7 * (ordinal - 1),
  );
  return candidate.getMonth() === month ? candidate : addDays(candidate, -7);
}

/**
 * The occurrence that follows `from`. Weekly and biweekly land on the chosen weekday. Monthly keeps
 * the same week of the month ("second Tuesday"). Custom is at least N days later, on that weekday.
 */
function occurrenceAfter(from: Date, schedule: ScheduleDraft): Date {
  switch (schedule.cadence) {
    case 'weekly':
      return firstWeekdayOnOrAfter(addDays(from, 1), schedule.dayOfWeek);
    case 'biweekly':
      return firstWeekdayOnOrAfter(addDays(from, 8), schedule.dayOfWeek);
    case 'monthly': {
      const ordinal = Math.ceil(from.getDate() / 7);
      return nthWeekdayOfMonth(
        from.getFullYear(),
        from.getMonth() + 1,
        schedule.dayOfWeek,
        ordinal,
      );
    }
    case 'custom': {
      const interval = isValidInterval(schedule.customIntervalDays)
        ? schedule.customIntervalDays
        : 7;
      return firstWeekdayOnOrAfter(addDays(from, interval), schedule.dayOfWeek);
    }
  }
}

/** The first upcoming 1:1 on the chosen weekday and time; later ones follow the cadence. */
export function calculateNextDate(schedule: ScheduleDraft, now: Date = new Date()): string {
  const today = startOfDay(now);
  let next = firstWeekdayOnOrAfter(today, schedule.dayOfWeek);
  if (next.getTime() === today.getTime()) {
    const [hours, minutes] = schedule.time.split(':').map(Number);
    const meeting = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      hours,
      minutes,
    );
    if (meeting.getTime() <= now.getTime()) next = addDays(next, 7);
  }
  return toIsoDate(next);
}

/** A 1:1 is overdue once its calendar day is before today. */
export function isOverdue(nextDate: string, now: Date = new Date()): boolean {
  const date = parseIsoDate(nextDate);
  return date !== null && date.getTime() < startOfDay(now).getTime();
}

/**
 * Moves to the following occurrence and drops any one-time override. A 1:1 that is already overdue
 * keeps advancing until it is no longer in the past, so skipping never leaves it overdue.
 */
export function skipNext(schedule: Schedule, now: Date = new Date()): Schedule {
  const current = parseIsoDate(schedule.nextDate);
  if (!current) return { ...schedule, nextDate: calculateNextDate(schedule, now) };
  const today = startOfDay(now);
  let next = occurrenceAfter(current, schedule);
  while (next.getTime() < today.getTime()) next = occurrenceAfter(next, schedule);
  const skipped: Schedule = { ...schedule, nextDate: toIsoDate(next) };
  delete skipped.overrideDate;
  return skipped;
}

/** One-time move of the next 1:1; the recurring pattern is untouched. */
export function reschedule(schedule: Schedule, newDate: string): Schedule {
  if (!parseIsoDate(newDate)) throw new RangeError('Reschedule date is not valid');
  return { ...schedule, nextDate: newDate, overrideDate: newDate };
}

/**
 * Builds the schedule to store after an edit. A change of cadence, interval or weekday recalculates
 * the next date. A pure time change keeps it (and any one-time override) unless it is already past.
 */
export function applyScheduleEdit(
  previous: Schedule | null,
  draft: ScheduleDraft,
  now: Date = new Date(),
): Schedule {
  const base: ScheduleDraft = {
    cadence: draft.cadence,
    dayOfWeek: draft.dayOfWeek,
    time: draft.time,
    ...(draft.cadence === 'custom' ? { customIntervalDays: draft.customIntervalDays } : {}),
  };
  const sameRhythm =
    previous !== null &&
    previous.cadence === base.cadence &&
    previous.dayOfWeek === base.dayOfWeek &&
    previous.customIntervalDays === base.customIntervalDays;
  if (sameRhythm && !isOverdue(previous.nextDate, now)) {
    return { ...previous, ...base };
  }
  return { ...base, nextDate: calculateNextDate(base, now) };
}
