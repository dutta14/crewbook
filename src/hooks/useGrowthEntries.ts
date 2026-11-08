import { useCallback, useMemo } from 'react';
import {
  createGrowthEntry,
  deleteGrowthEntry,
  getGrowthEntries,
  updateGrowthEntry,
  type GrowthEntryUpdate,
} from '../data/growthStore';
import { ValidationError } from '../data/errors';
import { getMember } from '../data/members';
import type { GrowthEntry, GrowthEntryInput } from '../types/growth';
import { deriveCurrentLevel, formatGrowthSummary } from '../utils/growthFormat';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useToast } from './useToast';

const SAVE_FAILED = "Couldn't save that entry. Try again.";
const DELETE_FAILED = "Couldn't delete that entry. Try again.";

export interface UseGrowthEntries {
  /** Newest first. */
  entries: GrowthEntry[];
  /** The latest entry's `to`, ignoring team transfers; null when there is nothing to derive it from. */
  currentLevel: string | null;
  /**
   * Every write waits for the encrypted store, so the screen only changes once it has landed.
   * A failed write rolls back and shows an error toast, then rejects so the caller can stand
   * down. A ValidationError rejects without a toast; the form reports it next to the field.
   */
  addEntry: (entry: GrowthEntryInput) => Promise<void>;
  updateEntry: (id: string, updates: GrowthEntryUpdate) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  /** Plain-text summary for a promo packet. Nothing is logged or stored; the caller copies it. */
  exportAsText: () => string;
}

export function useGrowthEntries(engineerId: string): UseGrowthEntries {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();

  const entries = useMemo(() => getGrowthEntries(storage, engineerId), [storage, engineerId]);
  const currentLevel = useMemo(() => deriveCurrentLevel(entries), [entries]);

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

  const addEntry = useCallback(
    (entry: GrowthEntryInput) =>
      run(() => createGrowthEntry(engineerId, entry, storage), SAVE_FAILED),
    [run, engineerId, storage],
  );
  const updateEntry = useCallback(
    (id: string, updates: GrowthEntryUpdate) =>
      run(() => updateGrowthEntry(id, updates, storage), SAVE_FAILED),
    [run, storage],
  );
  const deleteEntry = useCallback(
    (id: string) => run(() => deleteGrowthEntry(id, storage), DELETE_FAILED),
    [run, storage],
  );

  const exportAsText = useCallback(
    () =>
      formatGrowthSummary(
        getMember(engineerId, storage)?.name ?? 'Team member',
        currentLevel,
        entries,
      ),
    [engineerId, storage, currentLevel, entries],
  );

  return { entries, currentLevel, addEntry, updateEntry, deleteEntry, exportAsText };
}
