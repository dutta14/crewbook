import { useCallback, useMemo } from 'react';
import {
  createReminder as createReminderRecord,
  dismissReminder as dismissReminderRecord,
  getDueReminders,
  getReminders,
  snoozeReminder as snoozeReminderRecord,
  type ReminderInput,
  type SnoozeResult,
} from '../data/reminders';
import { ValidationError } from '../data/errors';
import type { Reminder, ReminderContext, SnoozeOption } from '../types/reminder';
import { useEncryptedStorage } from './useEncryptedStorage';
import { usePrivateEnvelope } from './usePrivateEnvelope';
import { useToast } from './useToast';

const SAVE_FAILED = "Couldn't save your reminder. Try again.";
const UPDATE_FAILED = "Couldn't update that reminder. Try again.";
const SNOOZE_FALLBACK_NOTICE = 'No 1:1 is scheduled, so the reminder is snoozed for a week.';

export interface UseRemindersOptions {
  /** Limits everything to one person. Leave out for the whole team. */
  personId?: string;
  /** When set, `due` holds the reminders that should be on screen in that context. */
  context?: ReminderContext;
  /** Fixed clock for tests; defaults to the current time. */
  now?: Date;
}

export interface UseReminders {
  /** False until the private envelope has been opened. */
  isReady: boolean;
  loadFailed: boolean;
  /** Every reminder, in the order it was created. */
  reminders: Reminder[];
  /** Not dismissed, including snoozed ones, so the manager can see what is still pending. */
  active: Reminder[];
  /** Dismissed, newest dismissal first. */
  past: Reminder[];
  /** Reminders that are due in `context`; empty when no context is given. */
  due: Reminder[];
  /**
   * Every write waits for the encrypted store. A failed write rolls back and shows an error toast,
   * then rejects so the caller can stand down. A ValidationError rejects without a toast; the form
   * reports it next to the field.
   */
  createReminder: (input: ReminderInput) => Promise<void>;
  dismissReminder: (id: string) => Promise<void>;
  snoozeReminder: (id: string, option: SnoozeOption) => Promise<void>;
}

export function useReminders({ personId, context, now }: UseRemindersOptions = {}): UseReminders {
  const storage = useEncryptedStorage();
  const { isReady: isPrivateUnlocked, loadFailed } = usePrivateEnvelope();
  const { showToast } = useToast();

  // `storage` is a new value after every write, so these follow edits made while on screen.
  const reminders = useMemo(
    () => (isPrivateUnlocked ? getReminders(storage, personId) : []),
    [isPrivateUnlocked, personId, storage],
  );
  const active = useMemo(
    () => reminders.filter((item) => item.status !== 'dismissed'),
    [reminders],
  );
  const past = useMemo(
    () =>
      reminders
        .filter((item) => item.status === 'dismissed')
        .sort((a, b) => Date.parse(b.dismissedAt ?? '') - Date.parse(a.dismissedAt ?? '')),
    [reminders],
  );
  const due = useMemo(
    () => (isPrivateUnlocked && context ? getDueReminders(storage, personId, context, now) : []),
    [context, isPrivateUnlocked, now, personId, storage],
  );

  const run = useCallback(
    async <T>(operation: () => Promise<T>, failure: string): Promise<T> => {
      try {
        return await operation();
      } catch (error) {
        if (!(error instanceof ValidationError)) showToast(failure, 'error');
        throw error;
      }
    },
    [showToast],
  );

  const createReminder = useCallback(
    async (input: ReminderInput) => {
      await run(() => createReminderRecord(input, storage), SAVE_FAILED);
    },
    [run, storage],
  );
  const dismissReminder = useCallback(
    async (id: string) => {
      await run(() => dismissReminderRecord(id, storage), UPDATE_FAILED);
    },
    [run, storage],
  );
  const snoozeReminder = useCallback(
    async (id: string, option: SnoozeOption) => {
      const result: SnoozeResult = await run(
        () => snoozeReminderRecord(id, option, storage, now),
        UPDATE_FAILED,
      );
      if (result.usedFallback) showToast(SNOOZE_FALLBACK_NOTICE, 'info');
    },
    [now, run, showToast, storage],
  );

  return {
    isReady: isPrivateUnlocked,
    loadFailed,
    reminders,
    active,
    past,
    due,
    createReminder,
    dismissReminder,
    snoozeReminder,
  };
}
