import { useCallback, useMemo } from 'react';
import { ValidationError } from '../data/errors';
import {
  createFeedbackEntry,
  deleteFeedbackEntry,
  getFeedbackEntries,
  getPromoPacketEntries,
  updateFeedbackEntry,
  type FeedbackUpdate,
} from '../data/feedbackStore';
import { getMember } from '../data/members';
import type { FeedbackEntry, FeedbackFilter, FeedbackInput } from '../types/feedback';
import { collectTags, filterFeedback } from '../utils/feedbackFilter';
import { formatPromoPacket } from '../utils/feedbackFormat';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useToast } from './useToast';

const SAVE_FAILED = "Couldn't save that feedback. Nothing was stored. Try again.";
const DELETE_FAILED = "Couldn't delete that feedback. Try again.";

export interface UseFeedback {
  /** Newest first, narrowed by the filter. */
  entries: FeedbackEntry[];
  /** Every entry, whatever the filter says. */
  totalCount: number;
  countForEngineer: (engineerId: string) => number;
  /** The tags in use for the filter's person, or for everyone when there is none. */
  availableTags: string[];
  /**
   * Every write waits for the encrypted store, so the screen only changes once it has landed.
   * A failed write rolls back and shows an error toast, then rejects so the caller can stand
   * down. A ValidationError rejects without a toast; the form reports it next to the field.
   * Needs the private envelope to be open; see usePrivateEnvelope.
   */
  addEntry: (entry: FeedbackInput) => Promise<void>;
  updateEntry: (id: string, updates: FeedbackUpdate) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  /**
   * Plain-text packet of one person's positive feedback between two days. Constructive and neutral
   * entries are never included, whatever filter the screen has. There is deliberately no way to
   * export everything. Nothing is logged or stored; the caller copies it.
   */
  exportPromoPacket: (engineerId: string, dateRange: { start: string; end: string }) => string;
}

/** The only way the UI reads feedback. Pass a memoised filter; it is compared by identity. */
export function useFeedback(filter?: FeedbackFilter): UseFeedback {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();

  const everything = useMemo(() => getFeedbackEntries(storage), [storage]);
  const entries = useMemo(() => filterFeedback(everything, filter), [everything, filter]);
  const filterEngineerId = filter?.engineerId;
  const availableTags = useMemo(
    () =>
      collectTags(
        filterEngineerId
          ? everything.filter((entry) => entry.engineerId === filterEngineerId)
          : everything,
      ),
    [everything, filterEngineerId],
  );

  const countForEngineer = useCallback(
    (engineerId: string) => everything.filter((entry) => entry.engineerId === engineerId).length,
    [everything],
  );

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
    (entry: FeedbackInput) => run(() => createFeedbackEntry(entry, storage), SAVE_FAILED),
    [run, storage],
  );
  const updateEntry = useCallback(
    (id: string, updates: FeedbackUpdate) =>
      run(() => updateFeedbackEntry(id, updates, storage), SAVE_FAILED),
    [run, storage],
  );
  const deleteEntry = useCallback(
    (id: string) => run(() => deleteFeedbackEntry(id, storage), DELETE_FAILED),
    [run, storage],
  );

  const exportPromoPacket = useCallback(
    (engineerId: string, dateRange: { start: string; end: string }) =>
      formatPromoPacket(
        getMember(engineerId, storage)?.name ?? 'Team member',
        dateRange,
        getPromoPacketEntries(storage, engineerId, dateRange),
      ),
    [storage],
  );

  return {
    entries,
    totalCount: everything.length,
    countForEngineer,
    availableTags,
    addEntry,
    updateEntry,
    deleteEntry,
    exportPromoPacket,
  };
}
