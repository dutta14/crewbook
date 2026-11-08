import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { LeaveEntry, LeaveType } from '../types/leave';
import { parseIsoDate } from '../utils/scheduleCalculator';
import { NotFoundError, ValidationError } from './errors';
import { getMember } from './members';

/** A leave type can reveal health or family details, so entries live in the private envelope. */
const STORAGE_KEY = 'leave';

/** Needs `get` as well because the person is validated against the team list. */
export type LeaveStorage = Pick<
  EncryptedStorageContextValue,
  'get' | 'set' | 'getPrivate' | 'setPrivate' | 'flush'
>;

export const LEAVE_TYPES: readonly LeaveType[] = ['pto', 'sick', 'personal', 'parental'];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  pto: 'PTO',
  sick: 'Sick',
  personal: 'Personal',
  parental: 'Parental',
};

const MIN_YEAR = 1970;
const MAX_YEAR = 2100;

export interface LeaveInput {
  memberId: string;
  type: LeaveType;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD, on or after the start date. */
  endDate: string;
}

export function isLeaveType(value: unknown): value is LeaveType {
  return typeof value === 'string' && (LEAVE_TYPES as readonly string[]).includes(value);
}

const isString = (value: unknown): value is string => typeof value === 'string';

function isLeaveEntry(value: unknown): value is LeaveEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    isString(entry.id) &&
    isString(entry.memberId) &&
    isLeaveType(entry.type) &&
    isString(entry.startDate) &&
    isString(entry.endDate) &&
    isString(entry.createdAt)
  );
}

function readLeave(storage: LeaveStorage): LeaveEntry[] {
  const stored = storage.getPrivate<unknown>(STORAGE_KEY);
  return Array.isArray(stored) ? stored.filter(isLeaveEntry) : [];
}

function cleanDay(value: unknown, label: string): string {
  const date = typeof value === 'string' ? parseIsoDate(value) : null;
  if (date === null || date.getFullYear() < MIN_YEAR || date.getFullYear() > MAX_YEAR) {
    throw new ValidationError(`${label} is not a valid date`);
  }
  return value as string;
}

/** Validates everything. The person must be on the team. Messages never repeat stored values. */
function clean(input: LeaveInput, storage: LeaveStorage): LeaveInput {
  const member = typeof input.memberId === 'string' ? getMember(input.memberId, storage) : null;
  if (!member) throw new ValidationError('Person must be on your team');
  if (!isLeaveType(input.type)) throw new ValidationError('Leave type is not valid');
  const startDate = cleanDay(input.startDate, 'Start date');
  const endDate = cleanDay(input.endDate, 'End date');
  // ISO dates sort the same as the days they name.
  if (endDate < startDate) throw new ValidationError("End date can't be before the start date");
  return { memberId: member.id, type: input.type, startDate, endDate };
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
  storage: LeaveStorage,
  previous: LeaveEntry[],
  next: LeaveEntry[],
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

export function createLeave(input: LeaveInput, storage: LeaveStorage): Promise<LeaveEntry> {
  return enqueue(async () => {
    const entry: LeaveEntry = {
      ...clean(input, storage),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const previous = readLeave(storage);
    await commit(storage, previous, [...previous, entry]);
    return { ...entry };
  });
}

export function updateLeave(
  id: string,
  input: LeaveInput,
  storage: LeaveStorage,
): Promise<LeaveEntry> {
  return enqueue(async () => {
    const previous = readLeave(storage);
    const existing = previous.find((entry) => entry.id === id);
    if (!existing) throw new NotFoundError(id);
    const updated: LeaveEntry = { ...clean(input, storage), id, createdAt: existing.createdAt };
    await commit(
      storage,
      previous,
      previous.map((entry) => (entry.id === id ? updated : entry)),
    );
    return { ...updated };
  });
}

export function deleteLeave(id: string, storage: LeaveStorage): Promise<void> {
  return enqueue(async () => {
    const previous = readLeave(storage);
    if (!previous.some((entry) => entry.id === id)) throw new NotFoundError(id);
    await commit(
      storage,
      previous,
      previous.filter((entry) => entry.id !== id),
    );
  });
}

/** Removes every entry for a member, for when they leave the team. */
export function deleteLeaveForMember(memberId: string, storage: LeaveStorage): Promise<void> {
  return enqueue(async () => {
    const previous = readLeave(storage);
    await commit(
      storage,
      previous,
      previous.filter((entry) => entry.memberId !== memberId),
    );
  });
}

/** Every entry, earliest start first. */
export function getLeave(storage: LeaveStorage): LeaveEntry[] {
  return sortLeave(readLeave(storage));
}

export function sortLeave(entries: LeaveEntry[]): LeaveEntry[] {
  return entries
    .map((entry) => ({ ...entry }))
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        a.endDate.localeCompare(b.endDate) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
}

export function leaveCoversDay(entry: LeaveEntry, day: string): boolean {
  return entry.startDate <= day && day <= entry.endDate;
}

/** Whether any day of the entry falls between `first` and `last`, both inclusive. */
export function leaveOverlapsRange(entry: LeaveEntry, first: string, last: string): boolean {
  return entry.startDate <= last && entry.endDate >= first;
}

/** Ids of the people out on a day, each counted once however many entries they have. */
export function peopleOutOn(entries: LeaveEntry[], day: string): string[] {
  return [...new Set(entries.filter((entry) => leaveCoversDay(entry, day)).map((e) => e.memberId))];
}
