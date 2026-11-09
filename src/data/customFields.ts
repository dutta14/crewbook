import type { CustomFieldDefinition, CustomFieldInput } from '../types/customField';
import type { TeamMember } from '../types/TeamMember';
import { reorderList } from '../utils/dragReorder';
import {
  CUSTOM_FIELDS_STORAGE_KEY,
  CUSTOM_FIELD_LIMITS,
  cleanFieldInput,
  cleanFieldValue,
  parseDefinitions,
} from './customFieldRules';
import { ValidationError } from './errors';
import { MEMBERS_STORAGE_KEY, enqueue, type MemberStorage } from './members';

export type CustomFieldStorage = MemberStorage;

/** Only the parts of a definition a manager can change. */
export type CustomFieldUpdate = Partial<CustomFieldInput>;

interface Change {
  key: string;
  previous: unknown;
  next: unknown;
}

const FIELD_GONE = 'That field no longer exists';

export function listCustomFields(
  storage: Pick<CustomFieldStorage, 'get'>,
): CustomFieldDefinition[] {
  return parseDefinitions(storage.get<unknown>(CUSTOM_FIELDS_STORAGE_KEY));
}

function readMembers(storage: Pick<CustomFieldStorage, 'get'>): TeamMember[] {
  const stored = storage.get<unknown>(MEMBERS_STORAGE_KEY);
  return Array.isArray(stored) ? (stored as TeamMember[]) : [];
}

const hasValue = (member: TeamMember, fieldId: string) =>
  Object.hasOwn(member.customFields ?? {}, fieldId) && member.customFields[fieldId] !== '';

/** How many members have a value for the field, so a delete can say what it would remove. */
export function countMembersWithValue(
  fieldId: string,
  storage: Pick<CustomFieldStorage, 'get'>,
): number {
  return readMembers(storage).filter((member) => hasValue(member, fieldId)).length;
}

/** True when a member holds a value for a field that is not defined (for example a damaged one). */
export function hasOrphanedValues(storage: Pick<CustomFieldStorage, 'get'>): boolean {
  const ids = new Set(listCustomFields(storage).map((field) => field.id));
  return readMembers(storage).some((member) =>
    Object.keys(member.customFields ?? {}).some((key) => !ids.has(key)),
  );
}

/**
 * Applies every change to memory, then forces one encrypted write, so a field and the member
 * values that depend on it are saved together or not at all. A failed write restores all of them.
 */
async function commit(storage: CustomFieldStorage, changes: Change[]): Promise<void> {
  for (const { key, next } of changes) storage.set(key, next);
  const failure = await storage.flush();
  if (!failure) return;
  try {
    for (const { key, previous } of changes) storage.set(key, previous);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
  throw failure;
}

const reindex = (fields: CustomFieldDefinition[]): CustomFieldDefinition[] =>
  fields.map((field, order) => ({ ...field, order }));

/** The members, with `update` applied to each one's values; unchanged members are returned as is. */
function mapMemberValues(
  members: TeamMember[],
  update: (values: Record<string, string>) => Record<string, string> | null,
): { members: TeamMember[]; changed: boolean } {
  const now = new Date().toISOString();
  let changed = false;
  const next = members.map((member) => {
    const customFields = update(member.customFields ?? {});
    if (customFields === null) return member;
    changed = true;
    return { ...member, customFields, updatedAt: now };
  });
  return { members: next, changed };
}

export function addCustomField(
  input: CustomFieldInput,
  storage: CustomFieldStorage,
): Promise<CustomFieldDefinition> {
  return enqueue(async () => {
    const previous = listCustomFields(storage);
    // The limit is enforced here, not only by the disabled button.
    if (previous.length >= CUSTOM_FIELD_LIMITS.count) {
      throw new ValidationError(`You can add up to ${CUSTOM_FIELD_LIMITS.count} custom fields`);
    }
    const field: CustomFieldDefinition = {
      ...cleanFieldInput(input, previous),
      id: crypto.randomUUID(),
      order: previous.length,
    };
    await commit(storage, [
      { key: CUSTOM_FIELDS_STORAGE_KEY, previous, next: [...previous, field] },
    ]);
    return structuredClone(field);
  });
}

/**
 * Changes a field's name, type or options. A member's value that no longer fits the new type or
 * options is removed in the same write, so no member is left holding a value the field rejects.
 */
export function editCustomField(
  id: string,
  updates: CustomFieldUpdate,
  storage: CustomFieldStorage,
): Promise<CustomFieldDefinition> {
  return enqueue(async () => {
    const previous = listCustomFields(storage);
    const existing = previous.find((field) => field.id === id);
    if (!existing) throw new ValidationError(FIELD_GONE);
    const clean = cleanFieldInput(
      {
        name: existing.name,
        type: existing.type,
        options: existing.options,
        ...updates,
      },
      previous,
      id,
    );
    const updated: CustomFieldDefinition = { ...clean, id, order: existing.order };
    const storedMembers = storage.get<unknown>(MEMBERS_STORAGE_KEY);
    const { members, changed } = mapMemberValues(readMembers(storage), (values) => {
      if (!Object.hasOwn(values, id)) return null;
      try {
        const value = cleanFieldValue(updated, values[id]);
        return value === values[id] ? null : { ...values, [id]: value };
      } catch {
        return Object.fromEntries(Object.entries(values).filter(([key]) => key !== id));
      }
    });
    await commit(storage, [
      {
        key: CUSTOM_FIELDS_STORAGE_KEY,
        previous,
        next: previous.map((field) => (field.id === id ? updated : field)),
      },
      ...(changed ? [{ key: MEMBERS_STORAGE_KEY, previous: storedMembers, next: members }] : []),
    ]);
    return structuredClone(updated);
  });
}

/** Deletes the field and every member's value for it in one write. */
export function removeCustomField(id: string, storage: CustomFieldStorage): Promise<void> {
  return enqueue(async () => {
    const previous = listCustomFields(storage);
    if (!previous.some((field) => field.id === id)) throw new ValidationError(FIELD_GONE);
    const storedMembers = storage.get<unknown>(MEMBERS_STORAGE_KEY);
    const { members, changed } = mapMemberValues(readMembers(storage), (values) =>
      Object.hasOwn(values, id)
        ? Object.fromEntries(Object.entries(values).filter(([key]) => key !== id))
        : null,
    );
    await commit(storage, [
      {
        key: CUSTOM_FIELDS_STORAGE_KEY,
        previous,
        next: reindex(previous.filter((field) => field.id !== id)),
      },
      ...(changed ? [{ key: MEMBERS_STORAGE_KEY, previous: storedMembers, next: members }] : []),
    ]);
  });
}

export function reorderCustomFields(
  fromIndex: number,
  toIndex: number,
  storage: CustomFieldStorage,
): Promise<void> {
  return enqueue(async () => {
    const previous = listCustomFields(storage);
    const isInRange = (index: number) =>
      Number.isInteger(index) && index >= 0 && index < previous.length;
    if (!isInRange(fromIndex) || !isInRange(toIndex)) {
      throw new ValidationError('That field cannot move there');
    }
    if (fromIndex === toIndex) return;
    const next = reindex(reorderList(previous, fromIndex, toIndex));
    // A reorder never adds or loses a field.
    if (next.length !== previous.length) throw new ValidationError('That field cannot move there');
    await commit(storage, [{ key: CUSTOM_FIELDS_STORAGE_KEY, previous, next }]);
  });
}

/** Removes values whose field is not defined. Runs on load, as a guard against an interrupted delete. */
export function purgeOrphanedValues(storage: CustomFieldStorage): Promise<void> {
  return enqueue(async () => {
    const ids = new Set(listCustomFields(storage).map((field) => field.id));
    const storedMembers = storage.get<unknown>(MEMBERS_STORAGE_KEY);
    const { members, changed } = mapMemberValues(readMembers(storage), (values) => {
      const kept = Object.entries(values).filter(([key]) => ids.has(key));
      return kept.length === Object.keys(values).length ? null : Object.fromEntries(kept);
    });
    if (!changed) return;
    await commit(storage, [{ key: MEMBERS_STORAGE_KEY, previous: storedMembers, next: members }]);
  });
}
