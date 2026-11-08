import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type {
  TeamMember,
  TeamMemberInput,
  TeamMemberStatus,
  TeamMemberUpdate,
} from '../types/TeamMember';
import type { Schedule } from '../types/Schedule';
import {
  isCadence,
  isDayOfWeek,
  isValidInterval,
  isValidTime,
  parseIsoDate,
} from '../utils/scheduleCalculator';
import { NotFoundError, ValidationError } from './errors';
import { MAX_HISTORY_ENTRIES, diffMember } from './timeline';

/** A property on the decrypted `crewbook_data` object, not a separate localStorage key. */
const STORAGE_KEY = 'members';

/** The slice of useEncryptedStorage() these functions need. */
export type MemberStorage = Pick<EncryptedStorageContextValue, 'get' | 'set' | 'flush'>;

export const MEMBER_LIMITS = {
  textLength: 200,
  emailLength: 254,
  avatarUrlLength: 2048,
  customFieldCount: 20,
  customFieldKeyLength: 50,
  customFieldValueLength: 1000,
  minYear: 1970,
  maxYear: 2100,
} as const;

const STATUSES: readonly TeamMemberStatus[] = ['active', 'on_leave', 'departing', 'new_hire'];
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const HTML_TAG_PATTERN = /<\/?[a-z!?]/i;
const CUSTOM_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ISO_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
const AVATAR_URL_PATTERN =
  /^(https?:\/\/\S+|data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+)$/;

export function isTeamMemberStatus(value: unknown): value is TeamMemberStatus {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

function cleanText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw new ValidationError(`${label} must be text`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(`${label} must be ${maxLength} characters or fewer`);
  }
  if (HTML_TAG_PATTERN.test(trimmed)) throw new ValidationError(`${label} must not contain HTML`);
  return trimmed;
}

function cleanName(value: unknown): string {
  const name = cleanText(value ?? '', 'Name', MEMBER_LIMITS.textLength);
  if (name.length === 0) throw new ValidationError('Name is required');
  return name;
}

function cleanEmail(value: unknown): string {
  const email = cleanText(value ?? '', 'Email', MEMBER_LIMITS.emailLength);
  if (email.length > 0 && !EMAIL_PATTERN.test(email)) {
    throw new ValidationError('Email is not valid');
  }
  return email;
}

function cleanStartDate(value: unknown): string {
  const startDate = cleanText(value ?? '', 'Start date', MEMBER_LIMITS.textLength);
  const match = ISO_DATE_PATTERN.exec(startDate);
  if (match) {
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const calendar = new Date(Date.UTC(year, month - 1, day));
    const isRealDay =
      calendar.getUTCFullYear() === year &&
      calendar.getUTCMonth() === month - 1 &&
      calendar.getUTCDate() === day;
    const inRange = year >= MEMBER_LIMITS.minYear && year <= MEMBER_LIMITS.maxYear;
    if (isRealDay && inRange && !Number.isNaN(Date.parse(startDate))) return startDate;
  }
  throw new ValidationError('Start date must be a valid ISO 8601 date between 1970 and 2100');
}

function cleanAvatarUrl(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const avatarUrl = cleanText(value, 'Avatar URL', MEMBER_LIMITS.avatarUrlLength);
  if (!AVATAR_URL_PATTERN.test(avatarUrl)) throw new ValidationError('Avatar URL is not valid');
  return avatarUrl;
}

function cleanCustomFields(value: unknown): Record<string, string> {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError('Custom fields must be an object');
  }
  const entries = Object.entries(value);
  if (entries.length > MEMBER_LIMITS.customFieldCount) {
    throw new ValidationError(
      `At most ${MEMBER_LIMITS.customFieldCount} custom fields are allowed`,
    );
  }
  const cleaned: Record<string, string> = {};
  for (const [key, fieldValue] of entries) {
    const isSafeKey =
      key.length > 0 &&
      key.length <= MEMBER_LIMITS.customFieldKeyLength &&
      CUSTOM_KEY_PATTERN.test(key) &&
      !key.startsWith('__') &&
      !RESERVED_KEYS.has(key);
    if (!isSafeKey) throw new ValidationError('A custom field name is not allowed');
    if (typeof fieldValue !== 'string') {
      throw new ValidationError('Custom field values must be text');
    }
    if (fieldValue.length > MEMBER_LIMITS.customFieldValueLength) {
      throw new ValidationError(
        `Custom field values must be ${MEMBER_LIMITS.customFieldValueLength} characters or fewer`,
      );
    }
    if (HTML_TAG_PATTERN.test(fieldValue)) {
      throw new ValidationError('Custom field values must not contain HTML');
    }
    cleaned[key] = fieldValue;
  }
  return cleaned;
}

/** Copies only known fields. Error messages never repeat the stored values. */
function cleanSchedule(value: unknown): Schedule | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError('Schedule must be an object');
  }
  const schedule = value as Record<string, unknown>;
  if (!isCadence(schedule.cadence)) throw new ValidationError('Schedule cadence is not valid');
  if (!isDayOfWeek(schedule.dayOfWeek)) throw new ValidationError('Schedule day is not valid');
  if (!isValidTime(schedule.time)) throw new ValidationError('Schedule time is not valid');
  if (typeof schedule.nextDate !== 'string' || !parseIsoDate(schedule.nextDate)) {
    throw new ValidationError('Schedule next date is not valid');
  }
  const { overrideDate, customIntervalDays } = schedule;
  if (
    overrideDate !== undefined &&
    (typeof overrideDate !== 'string' || !parseIsoDate(overrideDate))
  ) {
    throw new ValidationError('Schedule override date is not valid');
  }
  if (schedule.cadence === 'custom' && !isValidInterval(customIntervalDays)) {
    throw new ValidationError('Schedule interval must be a whole number of days from 1 to 365');
  }
  return {
    cadence: schedule.cadence,
    dayOfWeek: schedule.dayOfWeek,
    time: schedule.time,
    ...(schedule.cadence === 'custom' ? { customIntervalDays: customIntervalDays as number } : {}),
    nextDate: schedule.nextDate,
    ...(overrideDate === undefined ? {} : { overrideDate }),
  };
}

/** A manager must exist and must not create a loop through the reporting chain. */
function checkManager(
  manager: unknown,
  members: TeamMember[],
  selfId: string | null,
): string | null {
  if (manager === null || manager === undefined) return null;
  if (typeof manager !== 'string') throw new ValidationError('Manager must be a member id');
  const byId = new Map(members.map((member) => [member.id, member]));
  if (!byId.has(manager)) throw new ValidationError('Manager must be an existing member');
  if (selfId !== null) {
    const seen = new Set<string>();
    for (let current: string | null = manager; current !== null;) {
      if (current === selfId) throw new ValidationError('A member cannot report to themselves');
      if (seen.has(current)) break;
      seen.add(current);
      current = byId.get(current)?.manager ?? null;
    }
  }
  return manager;
}

/** Copies only known fields, so unexpected properties on the input never reach storage. */
function validate(
  input: TeamMemberInput | TeamMember,
  members: TeamMember[],
  selfId: string | null,
): TeamMemberInput {
  if (!isTeamMemberStatus(input.status)) throw new ValidationError('Status is not valid');
  const avatarUrl = cleanAvatarUrl(input.avatarUrl);
  const schedule = cleanSchedule(input.schedule);
  return {
    name: cleanName(input.name),
    role: cleanText(input.role ?? '', 'Role', MEMBER_LIMITS.textLength),
    level: cleanText(input.level ?? '', 'Level', MEMBER_LIMITS.textLength),
    startDate: cleanStartDate(input.startDate),
    email: cleanEmail(input.email),
    manager: checkManager(input.manager, members, selfId),
    status: input.status,
    ...(avatarUrl === undefined ? {} : { avatarUrl }),
    customFields: cleanCustomFields(input.customFields),
    ...(schedule === undefined ? {} : { schedule }),
  };
}

function readMembers(storage: MemberStorage): TeamMember[] {
  const stored = storage.get<unknown>(STORAGE_KEY);
  return Array.isArray(stored) ? (stored as TeamMember[]) : [];
}

// Mutations run one at a time so a rollback can never overwrite a later, successful write.
let mutationQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation);
  mutationQueue = result.catch(() => undefined);
  return result;
}

/**
 * Applies `next` to memory immediately (optimistic), then forces the encrypted write. If the write
 * fails the previous list is restored and the StorageWriteError is re-thrown for the caller's UI.
 */
async function commit(
  storage: MemberStorage,
  previous: TeamMember[],
  next: TeamMember[],
): Promise<void> {
  storage.set(STORAGE_KEY, next);
  const failure = await storage.flush();
  if (!failure) return;
  try {
    storage.set(STORAGE_KEY, previous);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
  throw failure;
}

/** Callers get copies, so editing a returned member cannot change the stored list. */
const copy = (member: TeamMember): TeamMember => structuredClone(member);

export function addMember(input: TeamMemberInput, storage: MemberStorage): Promise<TeamMember> {
  return enqueue(async () => {
    const previous = readMembers(storage);
    const now = new Date().toISOString();
    const member: TeamMember = {
      ...validate(input, previous, null),
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await commit(storage, previous, [...previous, member]);
    return copy(member);
  });
}

/** Merges the changed fields into the member, re-validates the result and refreshes updatedAt. */
export function updateMember(
  id: string,
  update: TeamMemberUpdate,
  storage: MemberStorage,
): Promise<TeamMember> {
  return enqueue(async () => {
    const previous = readMembers(storage);
    const existing = previous.find((member) => member.id === id);
    if (!existing) throw new NotFoundError(id);
    const now = new Date().toISOString();
    const updated: TeamMember = {
      ...validate({ ...existing, ...update }, previous, id),
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    const history = [...(existing.history ?? []), ...diffMember(existing, updated, now)];
    const member: TeamMember = history.length
      ? { ...updated, history: history.slice(-MAX_HISTORY_ENTRIES) }
      : updated;
    await commit(
      storage,
      previous,
      previous.map((current) => (current.id === id ? member : current)),
    );
    return copy(member);
  });
}

/**
 * Removes the member and clears any `manager` reference to them in the same write. This is the
 * data layer only: the UI must ask for confirmation (ConfirmDialog) before calling it.
 */
export function deleteMember(id: string, storage: MemberStorage): Promise<void> {
  return enqueue(async () => {
    const previous = readMembers(storage);
    if (!previous.some((member) => member.id === id)) throw new NotFoundError(id);
    const now = new Date().toISOString();
    const next = previous
      .filter((member) => member.id !== id)
      .map((member) =>
        member.manager === id ? { ...member, manager: null, updatedAt: now } : member,
      );
    await commit(storage, previous, next);
  });
}

export function getMember(id: string, storage: MemberStorage): TeamMember | null {
  const member = readMembers(storage).find((current) => current.id === id);
  return member ? copy(member) : null;
}

/** All members, sorted by name (case-insensitive). */
export function listMembers(storage: MemberStorage): TeamMember[] {
  return readMembers(storage)
    .map(copy)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
