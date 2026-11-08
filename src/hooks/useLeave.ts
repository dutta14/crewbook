import { useCallback, useMemo } from 'react';
import { ValidationError } from '../data/errors';
import {
  createLeave as createLeaveRecord,
  deleteLeave as deleteLeaveRecord,
  getLeave,
  updateLeave as updateLeaveRecord,
  type LeaveInput,
} from '../data/leave';
import type { LeaveEntry } from '../types/leave';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useToast } from './useToast';

const SAVE_FAILED = "Couldn't save that leave. Try again.";
const DELETE_FAILED = "Couldn't delete that leave. Try again.";

export interface UseLeave {
  /** Every entry, earliest start first. */
  entries: LeaveEntry[];
  /**
   * Every write waits for the encrypted store, so the screen only changes once it has landed.
   * A failed write rolls back and shows an error toast, then rejects so the caller can stand
   * down. A ValidationError rejects without a toast; the form reports it next to the field.
   */
  createLeave: (input: LeaveInput) => Promise<void>;
  updateLeave: (id: string, input: LeaveInput) => Promise<void>;
  deleteLeave: (id: string) => Promise<void>;
}

/** Needs the private envelope to be open; see usePrivateEnvelope. */
export function useLeave(): UseLeave {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();

  const entries = useMemo(() => getLeave(storage), [storage]);

  const run = useCallback(
    async (operation: () => Promise<unknown>, failure: string) => {
      try {
        await operation();
      } catch (error) {
        if (!(error instanceof ValidationError)) showToast(failure, 'error');
        throw error;
      }
    },
    [showToast],
  );

  const createLeave = useCallback(
    (input: LeaveInput) => run(() => createLeaveRecord(input, storage), SAVE_FAILED),
    [run, storage],
  );
  const updateLeave = useCallback(
    (id: string, input: LeaveInput) =>
      run(() => updateLeaveRecord(id, input, storage), SAVE_FAILED),
    [run, storage],
  );
  const deleteLeave = useCallback(
    (id: string) => run(() => deleteLeaveRecord(id, storage), DELETE_FAILED),
    [run, storage],
  );

  return { entries, createLeave, updateLeave, deleteLeave };
}
