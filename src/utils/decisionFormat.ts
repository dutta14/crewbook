import { parseIsoDate } from './scheduleCalculator';

/** "Jan 15, 2025" for a YYYY-MM-DD day, or null when the stored value is not a date. */
export function formatShortDate(isoDate: string): string | null {
  const date = parseIsoDate(isoDate);
  return date
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
}

/** "January 15, 2025", spelled out for screen reader labels. */
export function formatLongDate(isoDate: string): string | null {
  const date = parseIsoDate(isoDate);
  return date
    ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
}
