import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { FeedbackEntry, FeedbackInput, FeedbackType, FeedbackFilter } from '../types/feedback';
import { filterFeedback, sortNewestFirst } from '../utils/feedbackFilter';
import { parseIsoDate, toIsoDate } from '../utils/scheduleCalculator';
import { NotFoundError, ValidationError } from './errors';
import { getMember } from './members';

/*
 * Feedback lives in the private envelope and nowhere else. It is the manager's assessment of a
 * person, so it never leaves the manager's view.
 *
 * Seam for the sharing and export issues: nothing in this module, in useFeedback, or in the
 * feedback components may be imported by share, export or summary code (feedbackIsolation.test.ts
 * enforces that). The only way out is getPromoPacketEntries, which returns one person's positive
 * entries for an explicit date range. Nothing here logs content: not text, not tags.
 */
const STORAGE_KEY = 'feedback';

export type FeedbackStorage = Pick<
  EncryptedStorageContextValue,
  'get' | 'set' | 'getPrivate' | 'setPrivate' | 'flush'
>;

export const FEEDBACK_TEXT_MAX_LENGTH = 5000;
export const FEEDBACK_MAX_TAGS = 10;
export const FEEDBACK_TAG_MAX_LENGTH = 50;
export const FEEDBACK_TAG_PATTERN = /^[a-zA-Z0-9-]+$/;

export const FEEDBACK_TYPES: readonly FeedbackType[] = ['positive', 'constructive', 'neutral'];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  positive: 'Positive',
  constructive: 'Constructive',
  neutral: 'Neutral',
};

export type FeedbackUpdate = Partial<FeedbackInput>;

export function isFeedbackType(value: unknown): value is FeedbackType {
  return typeof value === 'string' && (FEEDBACK_TYPES as readonly string[]).includes(value);
}

const isString = (value: unknown): value is string => typeof value === 'string';

function isFeedbackEntry(value: unknown): value is FeedbackEntry {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isString(item.id) &&
    isString(item.engineerId) &&
    isString(item.date) &&
    parseIsoDate(item.date) !== null &&
    isFeedbackType(item.type) &&
    isString(item.text) &&
    Array.isArray(item.tags) &&
    item.tags.every(isString) &&
    isString(item.createdAt) &&
    isString(item.updatedAt)
  );
}

// A malformed entry is reported once per id; the message never carries anything the manager typed.
const reportedIds = new Set<string>();

function reportMalformed(value: unknown) {
  const id =
    typeof value === 'object' && value !== null && isString((value as { id?: unknown }).id)
      ? (value as { id: string }).id
      : 'unknown';
  if (reportedIds.has(id)) return;
  reportedIds.add(id);
  // eslint-disable-next-line no-console -- structural warning only; it names the entry, never its content
  console.warn(`Failed to parse feedback entry ${id}`);
}

function readEntries(storage: FeedbackStorage): FeedbackEntry[] {
  const stored = storage.getPrivate<unknown>(STORAGE_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter((item): item is FeedbackEntry => {
    if (isFeedbackEntry(item)) return true;
    reportMalformed(item);
    return false;
  });
}

/** Drops control characters but keeps line breaks, then enforces the length limit. */
function cleanText(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Feedback must be text');
  const text = Array.from(value)
    .filter((char) => char === '\n' || char.charCodeAt(0) > 0x1f)
    .join('')
    .trim();
  if (text === '') throw new ValidationError('Write an observation before saving');
  if (text.length > FEEDBACK_TEXT_MAX_LENGTH) {
    throw new ValidationError(`Feedback must be ${FEEDBACK_TEXT_MAX_LENGTH} characters or fewer`);
  }
  return text;
}

function cleanDate(value: unknown): string {
  if (typeof value !== 'string' || value === '') throw new ValidationError('Date is required');
  if (parseIsoDate(value) === null) throw new ValidationError('Date is not a valid date');
  if (value > toIsoDate(new Date())) throw new ValidationError("Date can't be in the future");
  return value;
}

function cleanType(value: unknown): FeedbackType {
  if (!isFeedbackType(value)) throw new ValidationError('Feedback type is not valid');
  return value;
}

/**
 * Trims, lower-cases and de-duplicates tags. A tag with anything but letters, digits or hyphens
 * is rejected, so markup can never ride in on a tag. Tags beyond the tenth are dropped.
 */
export function normalizeTags(values: unknown): string[] {
  if (!Array.isArray(values)) throw new ValidationError('Tags must be a list');
  const tags: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') throw new ValidationError('Tags must be text');
    const tag = value.trim().toLowerCase();
    if (tag === '') continue;
    if (tag.length > FEEDBACK_TAG_MAX_LENGTH) {
      throw new ValidationError(`Tags must be ${FEEDBACK_TAG_MAX_LENGTH} characters or fewer`);
    }
    if (!FEEDBACK_TAG_PATTERN.test(tag)) {
      throw new ValidationError('Tags can use letters, numbers and hyphens only');
    }
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags.slice(0, FEEDBACK_MAX_TAGS);
}

function requireEngineer(engineerId: unknown, storage: FeedbackStorage): string {
  if (typeof engineerId !== 'string' || !getMember(engineerId, storage)) {
    throw new ValidationError('Choose a team member');
  }
  return engineerId;
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
  storage: FeedbackStorage,
  previous: FeedbackEntry[],
  next: FeedbackEntry[],
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

export function createFeedbackEntry(
  input: FeedbackInput,
  storage: FeedbackStorage,
): Promise<FeedbackEntry> {
  return enqueue(async () => {
    const timestamp = new Date().toISOString();
    const entry: FeedbackEntry = {
      id: crypto.randomUUID(),
      engineerId: requireEngineer(input.engineerId, storage),
      date: cleanDate(input.date),
      type: cleanType(input.type),
      text: cleanText(input.text),
      tags: normalizeTags(input.tags),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const previous = readEntries(storage);
    await commit(storage, previous, [...previous, entry]);
    return { ...entry, tags: [...entry.tags] };
  });
}

export function updateFeedbackEntry(
  id: string,
  updates: FeedbackUpdate,
  storage: FeedbackStorage,
): Promise<FeedbackEntry> {
  return enqueue(async () => {
    const previous = readEntries(storage);
    const existing = previous.find((item) => item.id === id);
    if (!existing) throw new NotFoundError(id);
    const updated: FeedbackEntry = {
      ...existing,
      engineerId:
        'engineerId' in updates
          ? requireEngineer(updates.engineerId, storage)
          : existing.engineerId,
      date: 'date' in updates ? cleanDate(updates.date) : existing.date,
      type: 'type' in updates ? cleanType(updates.type) : existing.type,
      text: 'text' in updates ? cleanText(updates.text) : existing.text,
      tags: 'tags' in updates ? normalizeTags(updates.tags) : existing.tags,
      updatedAt: new Date().toISOString(),
    };
    await commit(
      storage,
      previous,
      previous.map((item) => (item.id === id ? updated : item)),
    );
    return { ...updated, tags: [...updated.tags] };
  });
}

export function deleteFeedbackEntry(id: string, storage: FeedbackStorage): Promise<void> {
  return enqueue(async () => {
    const previous = readEntries(storage);
    if (!previous.some((item) => item.id === id)) throw new NotFoundError(id);
    await commit(
      storage,
      previous,
      previous.filter((item) => item.id !== id),
    );
  });
}

/** Entries newest first, narrowed by the filter. Copies, so callers cannot edit the store. */
export function getFeedbackEntries(
  storage: FeedbackStorage,
  filter?: FeedbackFilter,
): FeedbackEntry[] {
  return sortNewestFirst(filterFeedback(readEntries(storage), filter)).map((item) => ({
    ...item,
    tags: [...item.tags],
  }));
}

export function getFeedbackCount(storage: FeedbackStorage, engineerId: string): number {
  return readEntries(storage).filter((item) => item.engineerId === engineerId).length;
}

/**
 * Everything a promo packet may contain: one person's positive entries between two explicit days,
 * oldest first. The type filter is fixed here, not taken from the caller, so a constructive entry
 * cannot reach a promotion write-up whatever the screen was showing.
 */
export function getPromoPacketEntries(
  storage: FeedbackStorage,
  engineerId: string,
  range: { start: string; end: string },
): FeedbackEntry[] {
  if (!engineerId || parseIsoDate(range.start) === null || parseIsoDate(range.end) === null) {
    return [];
  }
  return getFeedbackEntries(storage, {
    engineerId,
    type: 'positive',
    dateRange: { start: range.start, end: range.end },
  }).reverse();
}

/** Removes every entry for a member, for when they leave the team. */
export function deleteFeedbackForMember(memberId: string, storage: FeedbackStorage): Promise<void> {
  return enqueue(async () => {
    const previous = readEntries(storage);
    await commit(
      storage,
      previous,
      previous.filter((item) => item.engineerId !== memberId),
    );
  });
}
