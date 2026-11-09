import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { AgendaItem } from '../types/agenda';
import { NotFoundError, ValidationError } from './errors';

/** Agenda topics live in the private envelope, which the caller must have loaded already. */
const STORAGE_KEY = 'agendaItems';

export const AGENDA_TEXT_MAX_LENGTH = 500;
export const AGENDA_MAX_ITEMS = 50;

export type AgendaReadStorage = Pick<EncryptedStorageContextValue, 'getPrivate'>;
export type AgendaStorage = Pick<
  EncryptedStorageContextValue,
  'getPrivate' | 'setPrivate' | 'flush'
>;

export interface AgendaItemInput {
  memberId: string;
  text: string;
  addedBy: AgendaItem['addedBy'];
  /** Defaults to true: the manager opts a sensitive topic out instead of opting every one in. */
  includeInShare?: boolean;
}

const isString = (value: unknown): value is string => typeof value === 'string';
const isOptionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';

function isAgendaItem(value: unknown): value is AgendaItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isString(item.id) &&
    isString(item.memberId) &&
    isString(item.text) &&
    (item.addedBy === 'manager' || item.addedBy === 'engineer') &&
    isString(item.createdAt) &&
    isOptionalBoolean(item.includeInShare) &&
    isOptionalBoolean(item.discussed) &&
    isOptionalBoolean(item.archived) &&
    (item.archivedAt === undefined || isString(item.archivedAt))
  );
}

function readAll(storage: AgendaReadStorage): AgendaItem[] {
  const stored = storage.getPrivate<unknown>(STORAGE_KEY);
  return Array.isArray(stored) ? stored.filter(isAgendaItem) : [];
}

/** Oldest first, which is the natural order of an agenda. Ties keep the order they were added in. */
function byAge(items: AgendaItem[]): AgendaItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) => Date.parse(a.item.createdAt) - Date.parse(b.item.createdAt) || a.index - b.index,
    )
    .map(({ item }) => item);
}

/** The topics still on this person's agenda, oldest first. Call loadPrivate first. */
export function listAgendaForMember(memberId: string, storage: AgendaReadStorage): AgendaItem[] {
  return byAge(readAll(storage).filter((item) => item.memberId === memberId && !item.archived)).map(
    (item) => ({ ...item }),
  );
}

/**
 * Cleans text on the way in: markup tags and control characters (other than line breaks) are
 * removed, and what is left must be between 1 and 500 characters. Errors never repeat the text.
 */
export function cleanAgendaText(text: unknown): string {
  if (typeof text !== 'string') throw new ValidationError('Agenda item must be text');
  const cleaned = text
    // Only tag-shaped text is removed, so "a < b" survives.
    .replace(/<\/?[a-zA-Z!][^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x09\x0b-\x1f\x7f]/g, '')
    .trim();
  if (cleaned.length === 0) throw new ValidationError('Agenda item must not be empty');
  if (cleaned.length > AGENDA_TEXT_MAX_LENGTH) {
    throw new ValidationError(`Agenda item must be ${AGENDA_TEXT_MAX_LENGTH} characters or fewer`);
  }
  return cleaned;
}

// Writes run one at a time so a rollback can never overwrite a later, successful write.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => undefined);
  return result;
}

async function commit(next: AgendaItem[], storage: AgendaStorage): Promise<void> {
  const previous = storage.getPrivate<unknown>(STORAGE_KEY);
  storage.setPrivate(STORAGE_KEY, next);
  const failure = await storage.flush();
  if (!failure) return;
  try {
    storage.setPrivate(STORAGE_KEY, previous ?? []);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
  throw failure;
}

export function addAgendaItem(input: AgendaItemInput, storage: AgendaStorage): Promise<AgendaItem> {
  return enqueue(async () => {
    if (!isString(input.memberId) || input.memberId.length === 0) {
      throw new ValidationError('Agenda item needs a team member');
    }
    if (input.addedBy !== 'manager' && input.addedBy !== 'engineer') {
      throw new ValidationError('Choose who added the agenda item');
    }
    const text = cleanAgendaText(input.text);
    const all = readAll(storage);
    const active = all.filter((item) => item.memberId === input.memberId && !item.archived);
    if (active.length >= AGENDA_MAX_ITEMS) {
      throw new ValidationError(`An agenda holds at most ${AGENDA_MAX_ITEMS} items`);
    }
    const item: AgendaItem = {
      id: crypto.randomUUID(),
      memberId: input.memberId,
      text,
      addedBy: input.addedBy,
      createdAt: new Date().toISOString(),
      includeInShare: input.includeInShare ?? true,
    };
    await commit([...all, item], storage);
    return { ...item };
  });
}

function update(
  id: string,
  change: (item: AgendaItem) => AgendaItem,
  storage: AgendaStorage,
): Promise<AgendaItem> {
  return enqueue(async () => {
    const all = readAll(storage);
    const existing = all.find((item) => item.id === id && !item.archived);
    if (!existing) throw new NotFoundError(id);
    const updated = change(existing);
    await commit(
      all.map((item) => (item.id === id ? updated : item)),
      storage,
    );
    return { ...updated };
  });
}

/** Ticked or unticked in live mode. */
export function setAgendaDiscussed(id: string, discussed: boolean, storage: AgendaStorage) {
  return update(id, (item) => ({ ...item, discussed }), storage);
}

/** Whether a share link may carry this topic. */
export function setAgendaIncludeInShare(
  id: string,
  includeInShare: boolean,
  storage: AgendaStorage,
) {
  return update(id, (item) => ({ ...item, includeInShare }), storage);
}

/** Removes a topic for good. Archived ones are not reachable from here. */
export function deleteAgendaItem(id: string, storage: AgendaStorage): Promise<void> {
  return enqueue(async () => {
    const all = readAll(storage);
    if (!all.some((item) => item.id === id && !item.archived)) throw new NotFoundError(id);
    await commit(
      all.filter((item) => item.id !== id),
      storage,
    );
  });
}

/**
 * Called when a new 1:1 is recorded. The topics on this person's agenda are marked archived, not
 * deleted, so they stay in the history. Nothing is written when there is nothing to archive.
 */
export function archiveAgendaForMember(
  memberId: string,
  storage: AgendaStorage,
  now: Date = new Date(),
): Promise<void> {
  return enqueue(async () => {
    const all = readAll(storage);
    if (!all.some((item) => item.memberId === memberId && !item.archived)) return;
    const archivedAt = now.toISOString();
    await commit(
      all.map((item) =>
        item.memberId === memberId && !item.archived
          ? { ...item, archived: true, archivedAt }
          : item,
      ),
      storage,
    );
  });
}

/** Removes every topic, archived or not, for a person who leaves the team. */
export function deleteAgendaForMember(memberId: string, storage: AgendaStorage): Promise<void> {
  return enqueue(async () => {
    const all = readAll(storage);
    const kept = all.filter((item) => item.memberId !== memberId);
    if (kept.length === all.length) return;
    await commit(kept, storage);
  });
}
