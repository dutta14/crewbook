import { describe, expect, it, vi } from 'vitest';
import { createMember } from '../test-utils/factories';
import type { CustomFieldDefinition } from '../types/customField';
import type { TeamMember } from '../types/TeamMember';
import { StorageWriteError } from '../utils/encryptedStorage';
import {
  addCustomField,
  countMembersWithValue,
  editCustomField,
  hasOrphanedValues,
  listCustomFields,
  purgeOrphanedValues,
  removeCustomField,
  reorderCustomFields,
  type CustomFieldStorage,
} from './customFields';
import { ValidationError } from './errors';

const field = (id: string, order: number, extra: Partial<CustomFieldDefinition> = {}) =>
  ({ id, name: id.toUpperCase(), type: 'text', order, ...extra }) as CustomFieldDefinition;

function createStorage(
  data: { definitions?: CustomFieldDefinition[]; members?: TeamMember[] } = {},
  failure: StorageWriteError | null = null,
) {
  const store = new Map<string, unknown>([
    ['customFieldDefinitions', data.definitions ?? []],
    ['members', data.members ?? []],
  ]);
  const flush = vi.fn(async () => failure);
  const storage: CustomFieldStorage = {
    get: <T>(key: string) => (store.has(key) ? (store.get(key) as T) : null),
    set: <T>(key: string, value: T) => void store.set(key, value),
    flush,
  };
  return { storage, store, flush };
}

const WRITE_FAILED = new StorageWriteError(false, false);

describe('addCustomField', () => {
  it('stores a field with a generated id at the end of the list and flushes once', async () => {
    const { storage, store, flush } = createStorage({ definitions: [field('a', 0)] });

    const added = await addCustomField({ name: ' Team ', type: 'text' }, storage);

    expect(added).toMatchObject({ name: 'Team', type: 'text', order: 1 });
    expect(added.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.get('customFieldDefinitions')).toEqual([field('a', 0), added]);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('refuses an eleventh field', async () => {
    const definitions = Array.from({ length: 10 }, (_, index) => field(`f${index}`, index));
    const { storage, flush } = createStorage({ definitions });

    await expect(addCustomField({ name: 'One more', type: 'text' }, storage)).rejects.toThrow(
      'up to 10 custom fields',
    );
    expect(flush).not.toHaveBeenCalled();
  });

  it('rejects a duplicate name and a missing option list', async () => {
    const { storage } = createStorage({ definitions: [field('a', 0, { name: 'Team' })] });

    await expect(addCustomField({ name: 'TEAM', type: 'text' }, storage)).rejects.toThrow(
      ValidationError,
    );
    await expect(addCustomField({ name: 'Size', type: 'select' }, storage)).rejects.toThrow(
      'Add at least one option',
    );
  });

  it('puts the previous list back and rethrows when the write fails', async () => {
    const { storage, store } = createStorage({}, WRITE_FAILED);

    await expect(addCustomField({ name: 'Team', type: 'text' }, storage)).rejects.toBe(
      WRITE_FAILED,
    );
    expect(store.get('customFieldDefinitions')).toEqual([]);
  });
});

describe('editCustomField', () => {
  it('renames a field and keeps its id, order and member values', async () => {
    const member = createMember({ id: 'm1', customFields: { a: 'Payments' } });
    const { storage, store } = createStorage({
      definitions: [field('a', 0)],
      members: [member],
    });

    await editCustomField('a', { name: 'Squad' }, storage);

    expect(store.get('customFieldDefinitions')).toEqual([field('a', 0, { name: 'Squad' })]);
    expect((store.get('members') as TeamMember[])[0].customFields).toEqual({ a: 'Payments' });
  });

  it('clears member values that no longer fit the new type or options, in the same write', async () => {
    const members = [
      createMember({ id: 'm1', customFields: { a: 'S', b: '2024-01-02' } }),
      createMember({ id: 'm2', customFields: { a: 'L' } }),
    ];
    const { storage, store, flush } = createStorage({
      definitions: [field('a', 0, { type: 'select', options: ['S', 'L'] }), field('b', 1)],
      members,
    });

    await editCustomField('a', { options: ['S'] }, storage);
    await editCustomField('b', { type: 'date' }, storage);

    const saved = store.get('members') as TeamMember[];
    expect(saved[0].customFields).toEqual({ a: 'S', b: '2024-01-02' });
    expect(saved[1].customFields).toEqual({});
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it('restores the field and the member values when the write fails', async () => {
    const members = [createMember({ id: 'm1', customFields: { a: 'L' } })];
    const { storage, store } = createStorage(
      { definitions: [field('a', 0, { type: 'select', options: ['S', 'L'] })], members },
      WRITE_FAILED,
    );

    await expect(editCustomField('a', { options: ['S'] }, storage)).rejects.toBe(WRITE_FAILED);

    expect(listCustomFields(storage)[0].options).toEqual(['S', 'L']);
    expect(store.get('members')).toBe(members);
  });

  it('rejects a field that no longer exists and a name another field uses', async () => {
    const { storage } = createStorage({ definitions: [field('a', 0), field('b', 1)] });

    await expect(editCustomField('zzz', { name: 'X' }, storage)).rejects.toThrow(
      'no longer exists',
    );
    await expect(editCustomField('a', { name: 'b' }, storage)).rejects.toThrow('already exists');
  });
});

describe('removeCustomField', () => {
  it('removes the field, every member value for it and renumbers the rest in one write', async () => {
    const members = [
      createMember({ id: 'm1', customFields: { a: 'x', b: 'keep' } }),
      createMember({ id: 'm2', customFields: { b: 'keep' } }),
    ];
    const { storage, store, flush } = createStorage({
      definitions: [field('a', 0), field('b', 1)],
      members,
    });

    await removeCustomField('a', storage);

    expect(store.get('customFieldDefinitions')).toEqual([field('b', 0)]);
    const saved = store.get('members') as TeamMember[];
    expect(saved.map((member) => member.customFields)).toEqual([{ b: 'keep' }, { b: 'keep' }]);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('restores both the field and the member values when the write fails', async () => {
    const members = [createMember({ id: 'm1', customFields: { a: 'x' } })];
    const definitions = [field('a', 0)];
    const { storage, store } = createStorage({ definitions, members }, WRITE_FAILED);

    await expect(removeCustomField('a', storage)).rejects.toBe(WRITE_FAILED);

    expect(store.get('customFieldDefinitions')).toEqual(definitions);
    expect(store.get('members')).toBe(members);
  });

  it('rejects a field that does not exist without writing', async () => {
    const { storage, flush } = createStorage();

    await expect(removeCustomField('nope', storage)).rejects.toThrow('no longer exists');
    expect(flush).not.toHaveBeenCalled();
  });
});

describe('reorderCustomFields', () => {
  const three = [field('a', 0), field('b', 1), field('c', 2)];

  it('moves a field and renumbers every order', async () => {
    const { storage, store } = createStorage({ definitions: three });

    await reorderCustomFields(0, 2, storage);

    expect(store.get('customFieldDefinitions')).toEqual([
      field('b', 0),
      field('c', 1),
      field('a', 2),
    ]);
  });

  it('does not write when the field stays where it is', async () => {
    const { storage, flush } = createStorage({ definitions: three });

    await reorderCustomFields(1, 1, storage);

    expect(flush).not.toHaveBeenCalled();
  });

  it.each([
    [-1, 0],
    [0, 3],
    [1.5, 0],
  ])('rejects the move from %s to %s', async (from, to) => {
    const { storage } = createStorage({ definitions: three });

    await expect(reorderCustomFields(from, to, storage)).rejects.toThrow('cannot move');
  });

  it('restores the order when the write fails', async () => {
    const { storage } = createStorage({ definitions: three }, WRITE_FAILED);

    await expect(reorderCustomFields(0, 1, storage)).rejects.toBe(WRITE_FAILED);

    expect(listCustomFields(storage).map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('orphaned values', () => {
  it('counts the members that have a value for a field', () => {
    const { storage } = createStorage({
      definitions: [field('a', 0)],
      members: [
        createMember({ id: 'm1', customFields: { a: 'x' } }),
        createMember({ id: 'm2', customFields: { a: '' } }),
        createMember({ id: 'm3', customFields: {} }),
      ],
    });

    expect(countMembersWithValue('a', storage)).toBe(1);
  });

  it('finds and purges values whose field is not defined, leaving defined ones', async () => {
    const { storage, store, flush } = createStorage({
      definitions: [field('a', 0)],
      members: [createMember({ id: 'm1', customFields: { a: 'keep', gone: 'old' } })],
    });

    expect(hasOrphanedValues(storage)).toBe(true);
    await purgeOrphanedValues(storage);

    expect((store.get('members') as TeamMember[])[0].customFields).toEqual({ a: 'keep' });
    expect(hasOrphanedValues(storage)).toBe(false);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('does not write when there is nothing to purge', async () => {
    const { storage, flush } = createStorage({
      definitions: [field('a', 0)],
      members: [createMember({ id: 'm1', customFields: { a: 'x' } })],
    });

    await purgeOrphanedValues(storage);

    expect(flush).not.toHaveBeenCalled();
  });
});
