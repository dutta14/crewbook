import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { ActionItem, ActionItemStatus } from '../types/ActionItem';
import { isOverdue as isPastDay, parseIsoDate } from '../utils/scheduleCalculator';
import { NotFoundError, ValidationError } from './errors';
import { getMember } from './members';

/** Titles name commitments and performance expectations, so they live in the private envelope. */
const STORAGE_KEY = 'actionItems';

/** Needs `get`/`set` as well because owners and members are validated against the team list. */
export type ActionItemStorage = Pick<
  EncryptedStorageContextValue,
  'get' | 'set' | 'getPrivate' | 'setPrivate' | 'flush'
>;

export const ACTION_ITEM_TITLE_MAX_LENGTH = 200;
/** Owner id for the person running the 1:1. */
export const MANAGER_OWNER_ID = 'manager';
export const MANAGER_OWNER_NAME = 'Me';

export const ACTION_ITEM_STATUSES: readonly ActionItemStatus[] = ['open', 'done', 'cancelled'];

export type ActionItemInput = Omit<
  ActionItem,
  'id' | 'createdAt' | 'updatedAt' | 'ownerName' | 'status'
> & { status?: ActionItemStatus };

export function isActionItemStatus(value: unknown): value is ActionItemStatus {
  return typeof value === 'string' && (ACTION_ITEM_STATUSES as readonly string[]).includes(value);
}

function isActionItem(value: unknown): value is ActionItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.memberId === 'string' &&
    typeof item.title === 'string' &&
    typeof item.ownerId === 'string' &&
    typeof item.ownerName === 'string' &&
    (item.dueDate === undefined || typeof item.dueDate === 'string') &&
    (item.noteId === undefined || typeof item.noteId === 'string') &&
    isActionItemStatus(item.status) &&
    (item.includeInShare === undefined || typeof item.includeInShare === 'boolean') &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string'
  );
}

function readItems(storage: ActionItemStorage): ActionItem[] {
  const stored = storage.getPrivate<unknown>(STORAGE_KEY);
  return Array.isArray(stored) ? stored.filter(isActionItem) : [];
}

/** Throws a ValidationError that never repeats the title. */
function cleanTitle(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Title must be text');
  const title = value.trim();
  if (title.length === 0) throw new ValidationError('Title is required');
  if (title.length > ACTION_ITEM_TITLE_MAX_LENGTH) {
    throw new ValidationError(`Title must be ${ACTION_ITEM_TITLE_MAX_LENGTH} characters or fewer`);
  }
  return title;
}

function cleanDueDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || parseIsoDate(value) === null) {
    throw new ValidationError('Due date is not a valid date');
  }
  return value;
}

/** The owner must be the manager or someone on the team; the name always comes from the team. */
function resolveOwner(ownerId: unknown, storage: ActionItemStorage) {
  if (ownerId === MANAGER_OWNER_ID) return { ownerId, ownerName: MANAGER_OWNER_NAME };
  const owner = typeof ownerId === 'string' ? getMember(ownerId, storage) : null;
  if (!owner) throw new ValidationError('Owner must be you or a team member');
  return { ownerId: owner.id, ownerName: owner.name };
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
  storage: ActionItemStorage,
  previous: ActionItem[],
  next: ActionItem[],
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

export function createActionItem(
  input: ActionItemInput,
  storage: ActionItemStorage,
): Promise<ActionItem> {
  return enqueue(async () => {
    const title = cleanTitle(input.title);
    const dueDate = cleanDueDate(input.dueDate);
    const status = input.status ?? 'open';
    if (!isActionItemStatus(status)) throw new ValidationError('Status is not valid');
    if (typeof input.memberId !== 'string' || !getMember(input.memberId, storage)) {
      throw new ValidationError('Action item needs a team member');
    }
    const owner = resolveOwner(input.ownerId, storage);
    const now = new Date().toISOString();
    const item: ActionItem = {
      id: crypto.randomUUID(),
      memberId: input.memberId,
      ...(input.noteId ? { noteId: input.noteId } : {}),
      title,
      ...owner,
      ...(dueDate ? { dueDate } : {}),
      status,
      createdAt: now,
      updatedAt: now,
    };
    const previous = readItems(storage);
    await commit(storage, previous, [...previous, item]);
    return { ...item };
  });
}

/** Writes straight to the encrypted store, so an undo is just another call with `open`. */
export function updateStatus(
  id: string,
  status: ActionItemStatus,
  storage: ActionItemStorage,
): Promise<ActionItem> {
  return enqueue(async () => {
    if (!isActionItemStatus(status)) throw new ValidationError('Status is not valid');
    const previous = readItems(storage);
    const existing = previous.find((item) => item.id === id);
    if (!existing) throw new NotFoundError(id);
    const updated: ActionItem = { ...existing, status, updatedAt: new Date().toISOString() };
    await commit(
      storage,
      previous,
      previous.map((item) => (item.id === id ? updated : item)),
    );
    return { ...updated };
  });
}

/** Whether a share link may carry this item. Does not touch `updatedAt`: the item itself is unchanged. */
export function setIncludeInShare(
  id: string,
  includeInShare: boolean,
  storage: ActionItemStorage,
): Promise<ActionItem> {
  return enqueue(async () => {
    if (typeof includeInShare !== 'boolean') throw new ValidationError('Share choice is not valid');
    const previous = readItems(storage);
    const existing = previous.find((item) => item.id === id);
    if (!existing) throw new NotFoundError(id);
    const updated: ActionItem = { ...existing, includeInShare };
    await commit(
      storage,
      previous,
      previous.map((item) => (item.id === id ? updated : item)),
    );
    return { ...updated };
  });
}

/** Oldest due date first, items without a due date last, then in the order they were created. */
export function compareByDueDate(a: ActionItem, b: ActionItem): number {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (Boolean(a.dueDate) !== Boolean(b.dueDate)) return a.dueDate ? -1 : 1;
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

function select(items: ActionItem[], statusFilter?: ActionItemStatus): ActionItem[] {
  return items
    .filter((item) => statusFilter === undefined || item.status === statusFilter)
    .map((item) => ({ ...item }));
}

export function listByMember(
  memberId: string,
  storage: ActionItemStorage,
  statusFilter?: ActionItemStatus,
): ActionItem[] {
  return select(
    readItems(storage).filter((item) => item.memberId === memberId),
    statusFilter,
  ).sort(compareByDueDate);
}

/** Every member's items. Callers that show people should drop items whose member is gone. */
export function listAll(storage: ActionItemStorage, statusFilter?: ActionItemStatus): ActionItem[] {
  return select(readItems(storage), statusFilter).sort(compareByDueDate);
}

/** Whether the item is open and its due day is before today. Finished items are never overdue. */
export function isItemOverdue(
  item: Pick<ActionItem, 'status' | 'dueDate'>,
  now: Date = new Date(),
): boolean {
  return item.status === 'open' && item.dueDate !== undefined && isPastDay(item.dueDate, now);
}

export function getOverdueItems(storage: ActionItemStorage, now: Date = new Date()): ActionItem[] {
  return listAll(storage, 'open').filter((item) => isItemOverdue(item, now));
}

/** Removes every action item for a member, for when they leave the team. */
export function deleteActionItemsForMember(
  memberId: string,
  storage: ActionItemStorage,
): Promise<void> {
  return enqueue(async () => {
    const previous = readItems(storage);
    await commit(
      storage,
      previous,
      previous.filter((item) => item.memberId !== memberId),
    );
  });
}
