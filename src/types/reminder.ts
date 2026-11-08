export type TriggerType = 'next_1on1' | 'specific_date';
export type SnoozeOption = '1_day' | '1_week' | 'next_1on1';
export type ReminderStatus = 'active' | 'snoozed' | 'dismissed';
export type ReminderContext = 'dashboard' | '1on1_prep';

/** A note to self about one person. Its text can be about performance, so it stays private. */
export interface Reminder {
  id: string;
  text: string;
  linkedPersonId: string;
  /** Display name taken from the team list when the reminder is saved; never typed by the user. */
  linkedPersonName: string;
  triggerType: TriggerType;
  /** Calendar day, YYYY-MM-DD. Only set when the trigger is a specific date. */
  triggerDate?: string;
  status: ReminderStatus;
  /** Calendar day, YYYY-MM-DD. Set while the reminder is snoozed. */
  snoozedUntil?: string;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  dismissedAt?: string;
}
