import { parseIsoDate, toIsoDate } from './scheduleCalculator';

// All dates are YYYY-MM-DD strings in local time. Arithmetic goes through Date's calendar methods,
// never milliseconds, so daylight saving changes cannot move a day.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDate(day: string): Date {
  const date = parseIsoDate(day);
  if (!date) throw new RangeError('Not a valid calendar day');
  return date;
}

export function addDays(day: string, days: number): string {
  const date = toDate(day);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Moves by whole months and keeps the day of the month where it exists (Jan 31 + 1 is Feb 28). */
export function addMonths(day: string, months: number): string {
  const date = toDate(day);
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return toIsoDate(target);
}

/** The Monday of the week the day falls in. */
export function startOfWeek(day: string): string {
  const date = toDate(day);
  return addDays(day, -((date.getDay() + 6) % 7));
}

/** Monday to Sunday of the week the day falls in. */
export function getWeekDays(day: string): string[] {
  const monday = startOfWeek(day);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** Whole weeks (Monday to Sunday) covering the month the day falls in, 4 to 6 rows of 7 days. */
export function getMonthWeeks(day: string): string[][] {
  const date = toDate(day);
  const first = toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
  const last = toIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  const weeks: string[][] = [];
  for (let monday = startOfWeek(first); monday <= last; monday = addDays(monday, 7)) {
    weeks.push(getWeekDays(monday));
  }
  return weeks;
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / MS_PER_DAY);
}

export const dayOfMonth = (day: string) => toDate(day).getDate();

/** e.g. "Monday, November 9" */
export function formatLongDay(day: string): string {
  return toDate(day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** e.g. "Mon" */
export function formatWeekday(day: string): string {
  return toDate(day).toLocaleDateString(undefined, { weekday: 'short' });
}

/** e.g. "November 2026" */
export function formatMonthLabel(day: string): string {
  return toDate(day).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** e.g. "Nov 9, 2026 to Nov 15, 2026" */
export function formatWeekLabel(day: string): string {
  const days = getWeekDays(day);
  return formatDayRange(days[0], days[6], { withYear: true });
}

const shortDay = (day: string, withYear: boolean) =>
  toDate(day).toLocaleDateString(
    undefined,
    withYear
      ? { month: 'short', day: 'numeric', year: 'numeric' }
      : { month: 'short', day: 'numeric' },
  );

/** "Nov 9", or "Nov 9 to Nov 13" when it spans days. The year is added once it is not this year. */
export function formatDayRange(
  start: string,
  end: string,
  { withYear = false, today }: { withYear?: boolean; today?: string } = {},
): string {
  const showYear =
    withYear ||
    (today !== undefined &&
      (start.slice(0, 4) !== today.slice(0, 4) || end.slice(0, 4) !== today.slice(0, 4)));
  return start === end
    ? shortDay(start, showYear)
    : `${shortDay(start, showYear)} to ${shortDay(end, showYear)}`;
}
