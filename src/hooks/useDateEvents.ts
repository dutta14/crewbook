import { useCallback, useMemo } from 'react';
import {
  getDateEvents,
  getDueDateReminders,
  setDateEvent as setDateEventRecord,
} from '../data/dateEvents';
import { ValidationError } from '../data/errors';
import type { DateEvent, DateEventType, DateReminderData } from '../types/dateEvent';
import { useEncryptedStorage } from './useEncryptedStorage';
import { usePrivateEnvelope } from './usePrivateEnvelope';
import { useToast } from './useToast';

const SAVE_FAILED = "Couldn't save that date. Try again.";

export interface UseDateEvents {
  /** False until the private envelope has been opened. */
  isReady: boolean;
  loadFailed: boolean;
  /** Visa expiry, probation end, work anniversary and birthday, in that order. */
  events: DateEvent[];
  /**
   * Waits for the encrypted store. A failed write rolls back and shows an error toast, then
   * rejects. A ValidationError rejects without a toast; the form reports it next to the field.
   */
  setDate: (type: DateEventType, date: string | null) => Promise<void>;
}

export function useDateEvents(engineerId: string, now?: Date): UseDateEvents {
  const storage = useEncryptedStorage();
  const { isReady, loadFailed } = usePrivateEnvelope();
  const { showToast } = useToast();

  // `storage` is a new value after every write, so this follows edits made while on screen.
  const events = useMemo(
    () => (isReady ? getDateEvents(engineerId, storage, now) : []),
    [engineerId, isReady, now, storage],
  );

  const setDate = useCallback(
    async (type: DateEventType, date: string | null) => {
      try {
        await setDateEventRecord(engineerId, type, date, storage, now);
      } catch (error) {
        if (!(error instanceof ValidationError)) showToast(SAVE_FAILED, 'error');
        throw error;
      }
    },
    [engineerId, now, showToast, storage],
  );

  return { isReady, loadFailed, events, setDate };
}

/** Date reminders that are due today, for the dashboard. Empty until the private envelope is open. */
export function useDateReminders(now?: Date): DateReminderData[] {
  const storage = useEncryptedStorage();
  const { isReady } = usePrivateEnvelope();
  return useMemo(() => (isReady ? getDueDateReminders(storage, now) : []), [isReady, now, storage]);
}
