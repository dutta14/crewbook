const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;

/** True for an ISO 8601 date or date-time that names a real moment. */
export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));
}

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'} ago`;

/**
 * "Updated today", "Updated 3 days ago", "Updated 2 months ago". A malformed date reads
 * "Unknown date" so a damaged record never shows "NaN". A date in the future counts as today.
 */
export function formatRelativeDate(isoDate: string, now: Date = new Date()): string {
  if (!isIsoDate(isoDate)) return 'Unknown date';
  const days = Math.floor((now.getTime() - Date.parse(isoDate)) / MS_PER_DAY);
  if (days < 1) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days < 7) return `Updated ${plural(days, 'day')}`;
  if (days < 30) return `Updated ${plural(Math.floor(days / 7), 'week')}`;
  if (days < 365) return `Updated ${plural(Math.floor(days / 30), 'month')}`;
  return `Updated ${plural(Math.floor(days / 365), 'year')}`;
}
