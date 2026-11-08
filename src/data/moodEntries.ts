import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { MoodEntry, MoodScore } from '../types/MoodEntry';
import { isMoodScore } from '../utils/moodScale';
import { ValidationError } from './errors';

/**
 * Mood ratings are a manager's private perception of a person, so they live in the private
 * envelope under their own top-level `moods` property, apart from notes.
 */
const STORAGE_KEY = 'moods';

export const DEFAULT_MOOD_LIMIT = 12;

export type MoodStorage = Pick<EncryptedStorageContextValue, 'getPrivate' | 'setPrivate' | 'flush'>;

export interface MoodEntryInput {
  memberId: string;
  noteId: string;
  score: MoodScore;
}

function isMoodEntry(value: unknown): value is MoodEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.memberId === 'string' &&
    typeof entry.noteId === 'string' &&
    isMoodScore(entry.score) &&
    typeof entry.recordedAt === 'string'
  );
}

function readEntries(storage: MoodStorage): MoodEntry[] {
  const stored = storage.getPrivate<unknown>(STORAGE_KEY);
  return Array.isArray(stored) ? stored.filter(isMoodEntry) : [];
}

// Writes run one at a time so a rollback can never overwrite a later, successful write.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => undefined);
  return result;
}

/** Applies the change to memory, forces the encrypted write and restores `previous` on failure. */
async function commit(
  storage: MoodStorage,
  previous: MoodEntry[],
  next: MoodEntry[],
): Promise<void> {
  storage.setPrivate(STORAGE_KEY, next);
  const failure = await storage.flush();
  if (!failure) return;
  try {
    storage.setPrivate(STORAGE_KEY, previous);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
  throw failure;
}

/** Logs a rating for a note, replacing any earlier rating for that same note. */
export function addMoodEntry(input: MoodEntryInput, storage: MoodStorage): Promise<MoodEntry> {
  return enqueue(async () => {
    if (typeof input.memberId !== 'string' || input.memberId.length === 0) {
      throw new ValidationError('Mood needs a team member');
    }
    if (typeof input.noteId !== 'string' || input.noteId.length === 0) {
      throw new ValidationError('Mood needs a note');
    }
    if (!isMoodScore(input.score)) throw new ValidationError('Mood must be a whole number 1 to 5');
    const entry: MoodEntry = {
      id: crypto.randomUUID(),
      memberId: input.memberId,
      noteId: input.noteId,
      score: input.score,
      recordedAt: new Date().toISOString(),
    };
    const previous = readEntries(storage);
    await commit(storage, previous, [
      ...previous.filter((existing) => existing.noteId !== input.noteId),
      entry,
    ]);
    return { ...entry };
  });
}

/** A member's most recent entries, oldest first, ready to plot. */
export function listMoodEntries(
  memberId: string,
  storage: MoodStorage,
  limit: number = DEFAULT_MOOD_LIMIT,
): MoodEntry[] {
  if (!Number.isInteger(limit) || limit <= 0) return [];
  return readEntries(storage)
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.memberId === memberId)
    .sort(
      (a, b) =>
        Date.parse(a.entry.recordedAt) - Date.parse(b.entry.recordedAt) || a.index - b.index,
    )
    .slice(-limit)
    .map(({ entry }) => ({ ...entry }));
}

/** Clears the rating logged with a note, for when the manager deselects it. */
export function deleteMoodEntry(noteId: string, storage: MoodStorage): Promise<void> {
  return enqueue(async () => {
    const previous = readEntries(storage);
    if (!previous.some((entry) => entry.noteId === noteId)) return;
    await commit(
      storage,
      previous,
      previous.filter((entry) => entry.noteId !== noteId),
    );
  });
}

/** Removes every rating for a member, for when they leave the team. */
export function deleteMoodEntriesForMember(memberId: string, storage: MoodStorage): Promise<void> {
  return enqueue(async () => {
    const previous = readEntries(storage);
    await commit(
      storage,
      previous,
      previous.filter((entry) => entry.memberId !== memberId),
    );
  });
}
