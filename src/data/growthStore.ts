import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { GrowthChangeType, GrowthEntry, GrowthEntryInput } from '../types/growth';
import { parseIsoDate } from '../utils/scheduleCalculator';
import { NotFoundError, ValidationError } from './errors';
import { getMember } from './members';

/** Promotion history and the notes behind it are career-sensitive, so they live in the private envelope. */
const STORAGE_KEY = 'growth';

/** Needs `get` as well because the person is validated against the team list. */
export type GrowthStorage = Pick<
  EncryptedStorageContextValue,
  'get' | 'set' | 'getPrivate' | 'setPrivate' | 'flush'
>;

export const GROWTH_TEXT_MAX_LENGTH = 500;

export const GROWTH_CHANGE_TYPES: readonly GrowthChangeType[] = [
  'promotion',
  'role_change',
  'team_transfer',
  'title_update',
];

export const GROWTH_CHANGE_TYPE_LABELS: Record<GrowthChangeType, string> = {
  promotion: 'Promotion',
  role_change: 'Role change',
  team_transfer: 'Team transfer',
  title_update: 'Title update',
};

/** The fields a manager can change; id, person and timestamps are never taken from the caller. */
export type GrowthEntryUpdate = Partial<GrowthEntryInput>;

export function isGrowthChangeType(value: unknown): value is GrowthChangeType {
  return typeof value === 'string' && (GROWTH_CHANGE_TYPES as readonly string[]).includes(value);
}

const isString = (value: unknown): value is string => typeof value === 'string';

function isGrowthEntry(value: unknown): value is GrowthEntry {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isString(item.id) &&
    isString(item.engineerId) &&
    isString(item.date) &&
    parseIsoDate(item.date) !== null &&
    isGrowthChangeType(item.changeType) &&
    isString(item.from) &&
    isString(item.to) &&
    isString(item.notes) &&
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
  console.warn(`Failed to parse growth entry ${id}`);
}

function readEntries(storage: GrowthStorage): GrowthEntry[] {
  const stored = storage.getPrivate<unknown>(STORAGE_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter((item): item is GrowthEntry => {
    if (isGrowthEntry(item)) return true;
    reportMalformed(item);
    return false;
  });
}

/** Drops control characters but keeps line breaks, then enforces the length limit. */
function cleanText(value: unknown, label: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new ValidationError(`${label} must be text`);
  const text = Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return char === '\n' || code > 0x1f;
    })
    .join('')
    .trim();
  if (text.length > GROWTH_TEXT_MAX_LENGTH) {
    throw new ValidationError(`${label} must be ${GROWTH_TEXT_MAX_LENGTH} characters or fewer`);
  }
  return text;
}

function cleanDate(value: unknown): string {
  if (typeof value !== 'string' || value === '') throw new ValidationError('Date is required');
  if (parseIsoDate(value) === null) throw new ValidationError('Date is not a valid date');
  return value;
}

function cleanChangeType(value: unknown): GrowthChangeType {
  if (!isGrowthChangeType(value)) throw new ValidationError('Change type is not valid');
  return value;
}

function requireEngineer(engineerId: unknown, storage: GrowthStorage): string {
  if (typeof engineerId !== 'string' || !getMember(engineerId, storage)) {
    throw new ValidationError('This needs a team member');
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
  storage: GrowthStorage,
  previous: GrowthEntry[],
  next: GrowthEntry[],
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

export function createGrowthEntry(
  engineerId: string,
  input: GrowthEntryInput,
  storage: GrowthStorage,
): Promise<GrowthEntry> {
  return enqueue(async () => {
    const timestamp = new Date().toISOString();
    const entry: GrowthEntry = {
      id: crypto.randomUUID(),
      engineerId: requireEngineer(engineerId, storage),
      date: cleanDate(input.date),
      changeType: cleanChangeType(input.changeType),
      from: cleanText(input.from, 'From'),
      to: cleanText(input.to, 'To'),
      notes: cleanText(input.notes, 'Notes'),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const previous = readEntries(storage);
    await commit(storage, previous, [...previous, entry]);
    return { ...entry };
  });
}

export function updateGrowthEntry(
  id: string,
  updates: GrowthEntryUpdate,
  storage: GrowthStorage,
): Promise<GrowthEntry> {
  return enqueue(async () => {
    const previous = readEntries(storage);
    const existing = previous.find((item) => item.id === id);
    if (!existing) throw new NotFoundError(id);
    const updated: GrowthEntry = {
      ...existing,
      date: 'date' in updates ? cleanDate(updates.date) : existing.date,
      changeType:
        'changeType' in updates ? cleanChangeType(updates.changeType) : existing.changeType,
      from: 'from' in updates ? cleanText(updates.from, 'From') : existing.from,
      to: 'to' in updates ? cleanText(updates.to, 'To') : existing.to,
      notes: 'notes' in updates ? cleanText(updates.notes, 'Notes') : existing.notes,
      updatedAt: new Date().toISOString(),
    };
    await commit(
      storage,
      previous,
      previous.map((item) => (item.id === id ? updated : item)),
    );
    return { ...updated };
  });
}

export function deleteGrowthEntry(id: string, storage: GrowthStorage): Promise<void> {
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

/**
 * One person's entries, newest first. Entries on the same day (a promotion and its title update,
 * say) show the one recorded last on top.
 */
export function getGrowthEntries(storage: GrowthStorage, engineerId: string): GrowthEntry[] {
  return readEntries(storage)
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.engineerId === engineerId)
    .sort((a, b) => {
      if (a.item.date !== b.item.date) return a.item.date < b.item.date ? 1 : -1;
      return Date.parse(b.item.createdAt) - Date.parse(a.item.createdAt) || b.index - a.index;
    })
    .map(({ item }) => ({ ...item }));
}

/** Removes every entry for a member, for when they leave the team. */
export function deleteGrowthForMember(memberId: string, storage: GrowthStorage): Promise<void> {
  return enqueue(async () => {
    const previous = readEntries(storage);
    await commit(
      storage,
      previous,
      previous.filter((item) => item.engineerId !== memberId),
    );
  });
}
