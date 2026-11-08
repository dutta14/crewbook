import type { Schedule } from '../types/Schedule';
import { parseIsoDate } from './scheduleCalculator';

export const CADENCE_LABELS = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  custom: 'Custom',
} as const;

export const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
} as const;

/** e.g. "Every 2 weeks". */
export function describeCadence({ cadence, customIntervalDays }: Schedule): string {
  switch (cadence) {
    case 'weekly':
      return 'Every week';
    case 'biweekly':
      return 'Every 2 weeks';
    case 'monthly':
      return 'Every month';
    case 'custom':
      return customIntervalDays === 1 ? 'Every day' : `Every ${customIntervalDays ?? 7} days`;
  }
}

/** "14:30" becomes "2:30 PM". */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** e.g. "Tuesdays at 10:00 AM". */
export function describeDayAndTime({ dayOfWeek, time }: Schedule): string {
  return `${DAY_LABELS[dayOfWeek]}s at ${formatTime(time)}`;
}

/** e.g. "Tue, Nov 10, 2026", or null when the stored value is not a date. */
export function formatScheduleDate(isoDate: string): string | null {
  const date = parseIsoDate(isoDate);
  return date
    ? date.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;
}
