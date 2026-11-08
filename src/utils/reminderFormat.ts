import type { Reminder, SnoozeOption } from '../types/reminder';
import { isReminderSnoozed } from '../data/reminders';
import { toIsoDate } from './scheduleCalculator';
import { formatScheduleDate } from './scheduleFormat';

/** Longest slice of a reminder that is put into an accessible name. */
export const REMINDER_LABEL_MAX_LENGTH = 30;

export const SNOOZE_LABELS: Record<SnoozeOption, string> = {
  '1_day': '1 day',
  '1_week': '1 week',
  next_1on1: 'Next 1:1',
};

/**
 * The start of a reminder for a button name. A cut always ends with an ellipsis, so the shortened
 * text cannot be mistaken for the whole reminder.
 */
export function truncateReminderText(
  text: string,
  maxLength: number = REMINDER_LABEL_MAX_LENGTH,
): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length <= maxLength ? oneLine : `${oneLine.slice(0, maxLength).trimEnd()}…`;
}

/** When a reminder will next surface, or when it was dismissed. */
export function describeReminderTiming(reminder: Reminder, now: Date = new Date()): string {
  if (reminder.status === 'dismissed') {
    const dismissed = reminder.dismissedAt ? new Date(reminder.dismissedAt) : null;
    const label =
      dismissed && !Number.isNaN(dismissed.getTime())
        ? formatScheduleDate(toIsoDate(dismissed))
        : null;
    return label ? `Dismissed ${label}` : 'Dismissed';
  }
  if (isReminderSnoozed(reminder, now) && reminder.snoozedUntil) {
    const label = formatScheduleDate(reminder.snoozedUntil);
    if (label) return `Snoozed until ${label}`;
  }
  if (reminder.triggerType === 'specific_date' && reminder.triggerDate) {
    const label = formatScheduleDate(reminder.triggerDate);
    if (label) return `On ${label}`;
  }
  return 'Before next 1:1';
}
