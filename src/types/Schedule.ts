export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'custom';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

export interface Schedule {
  cadence: Cadence;
  dayOfWeek: DayOfWeek;
  /** "HH:mm", 24 hour. */
  time: string;
  /** Only meaningful when cadence is "custom". */
  customIntervalDays?: number;
  /** ISO 8601 calendar date (YYYY-MM-DD) of the next 1:1. */
  nextDate: string;
  /** Set when the next 1:1 was moved by hand; only that one occurrence is affected. */
  overrideDate?: string;
}
