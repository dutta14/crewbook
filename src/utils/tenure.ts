import type { TeamMember } from '../types/TeamMember';
import type { TenureBar, TenureScale, TenureSortField, TenureStatus } from '../types/tenure';
import { parseIsoDate, toIsoDate } from './scheduleCalculator';
import { toDateAttribute } from './startDate';

export const TENURE_SORT_FIELDS: readonly TenureSortField[] = ['startDate', 'tenureLength', 'name'];

export const isTenureSortField = (value: unknown): value is TenureSortField =>
  typeof value === 'string' && (TENURE_SORT_FIELDS as readonly string[]).includes(value);

const TENURE_STATUS_LABELS: Record<TenureStatus, string> = {
  active: 'Active',
  on_leave: 'On leave',
  new_hire: 'New hire',
  departing: 'Departing',
};

export const tenureStatusLabel = (status: TenureStatus): string => TENURE_STATUS_LABELS[status];

/** Whole calendar months from `start` to `end`; a month only counts once its day has come round. */
export function monthsBetween(start: Date, end: Date): number {
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) -
    (end.getDate() < start.getDate() ? 1 : 0);
  return Math.max(0, months);
}

const split = (months: number) => ({ years: Math.floor(months / 12), rest: months % 12 });

/** e.g. "2y 4m", or "7m" under a year. */
export function formatTenure(months: number): string {
  const { years, rest } = split(months);
  return years > 0 ? `${years}y ${rest}m` : `${rest}m`;
}

/** e.g. "2yr 4mo", for tooltips. */
export function formatTenureShort(months: number): string {
  const { years, rest } = split(months);
  return years > 0 ? `${years}yr ${rest}mo` : `${rest}mo`;
}

/** e.g. "2 years 4 months", for screen readers. */
export function formatTenureSpoken(months: number): string {
  const { years, rest } = split(months);
  const part = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`;
  if (years === 0) return part(rest, 'month');
  return rest === 0 ? part(years, 'year') : `${part(years, 'year')} ${part(rest, 'month')}`;
}

/** e.g. "Mar 2023", or the raw value when it is not a date. */
export function formatMonthYear(isoDate: string): string {
  const day = parseIsoDate(isoDate);
  return day ? day.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : isoDate;
}

/**
 * One bar per member whose start date can be read; anyone else is left out rather than crashing
 * the chart. A departing member's bar ends at their expected departure, everyone else's at today.
 */
export function buildTenureBars(members: TeamMember[], now: Date = new Date()): TenureBar[] {
  const today = toIsoDate(now);
  const bars: TenureBar[] = [];
  for (const member of members) {
    const start = parseIsoDate(toDateAttribute(member.startDate));
    if (!start) continue;
    const startDate = toIsoDate(start);
    const startsInFuture = startDate > today;
    const departure =
      member.status === 'departing' &&
      typeof member.departureDate === 'string' &&
      parseIsoDate(member.departureDate) !== null &&
      member.departureDate >= startDate
        ? member.departureDate
        : null;
    const endDate = !startsInFuture && departure ? departure : today;
    const end = parseIsoDate(endDate) ?? now;
    const tenureMonths = startsInFuture ? 0 : monthsBetween(start, end);
    bars.push({
      engineerId: member.id,
      name: member.name,
      startDate,
      endDate,
      status: member.status,
      tenureMonths,
      tenureLabel: formatTenure(tenureMonths),
      startsInFuture,
      departureUnknown: member.status === 'departing' && departure === null,
    });
  }
  return bars;
}

const byName = (a: TenureBar, b: TenureBar) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

const COMPARATORS: Record<TenureSortField, (a: TenureBar, b: TenureBar) => number> = {
  startDate: (a, b) => a.startDate.localeCompare(b.startDate) || byName(a, b),
  tenureLength: (a, b) => b.tenureMonths - a.tenureMonths || byName(a, b),
  name: byName,
};

/** Earliest start first, longest tenure first, or A to Z. Returns a new array. */
export function sortTenureBars(bars: TenureBar[], field: TenureSortField): TenureBar[] {
  return [...bars].sort(COMPARATORS[field]);
}

/** The mean tenure of people who have started, to the nearest month. */
export function averageTenure(bars: TenureBar[]): { months: number; label: string } {
  const started = bars.filter((bar) => !bar.startsInFuture);
  const total = started.reduce((sum, bar) => sum + bar.tenureMonths, 0);
  const months = started.length === 0 ? 0 : Math.round(total / started.length);
  return { months, label: formatTenure(months) };
}

/** Whole years, from the first year anyone started to the last year any bar reaches. */
export function buildTenureScale(bars: TenureBar[], now: Date = new Date()): TenureScale {
  const today = toIsoDate(now);
  const first = bars.reduce((min, bar) => (bar.startDate < min ? bar.startDate : min), today);
  const last = bars.reduce(
    (max, bar) => (bar.endDate > max ? bar.endDate : bar.startDate > max ? bar.startDate : max),
    today,
  );
  const minYear = Number(first.slice(0, 4));
  const maxYear = Number(last.slice(0, 4));
  return {
    minDate: `${String(minYear).padStart(4, '0')}-01-01`,
    maxDate: `${String(maxYear + 1).padStart(4, '0')}-01-01`,
    years: Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index),
  };
}
