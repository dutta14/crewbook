import { DEFAULT_SETTINGS, type DateFormat } from '../types/settings';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Midnight (local time) of the calendar day a stored start date falls on. */
export function startOfStartDay(startDate: string): Date {
  const dateOnly = DATE_ONLY.exec(startDate);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  const parsed = new Date(startDate);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/** Whole calendar days from `now` until the start date: 0 is today, negative is in the past. */
export function daysUntilStart(startDate: string, now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Rounding absorbs the 23 and 25 hour days around daylight saving changes.
  return Math.round((startOfStartDay(startDate).getTime() - today.getTime()) / DAY_MS);
}

/** YYYY-MM-DD in local time, for the `datetime` attribute of a `<time>` element. */
export function toDateAttribute(startDate: string): string {
  const day = startOfStartDay(startDate);
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${day.getFullYear()}-${month}-${date}`;
}

let activeDateFormat: DateFormat = DEFAULT_SETTINGS.dateFormat;

/** Sets the order every displayed date follows. The app shell calls this from the saved setting. */
export function setActiveDateFormat(format: DateFormat): void {
  activeDateFormat = format;
}

/** e.g. "Mar 13, 2023", or "13 Mar 2023" for DD/MM/YYYY; null when the stored value is not a date. */
export function formatStartDate(
  startDate: string,
  format: DateFormat = activeDateFormat,
): string | null {
  const day = startOfStartDay(startDate);
  if (Number.isNaN(day.getTime())) return null;
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return format === 'DD/MM/YYYY'
    ? day.toLocaleDateString('en-GB', options)
    : day.toLocaleDateString(undefined, options);
}
