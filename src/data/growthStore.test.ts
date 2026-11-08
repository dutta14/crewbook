import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGrowthEntry as buildEntry, createMember } from '../test-utils/factories';
import { StorageWriteError } from '../utils/encryptedStorage';
import { NotFoundError, ValidationError } from './errors';
import {
  GROWTH_TEXT_MAX_LENGTH,
  createGrowthEntry,
  deleteGrowthEntry,
  deleteGrowthForMember,
  getGrowthEntries,
  isGrowthChangeType,
  updateGrowthEntry,
  type GrowthStorage,
} from './growthStore';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

function createStorage(
  privateData: Record<string, unknown> = {},
  failure: StorageWriteError | null = null,
) {
  const data = new Map<string, unknown>(Object.entries(privateData));
  const publicData = new Map<string, unknown>([['members', [ALEX, PRIYA]]]);
  const flush = vi.fn(async () => failure);
  const storage: GrowthStorage = {
    get: <T>(key: string) => (publicData.has(key) ? (publicData.get(key) as T) : null),
    set: <T>(key: string, value: T) => void publicData.set(key, value),
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, flush };
}

const input = (overrides: Partial<Parameters<typeof createGrowthEntry>[1]> = {}) => ({
  date: '2025-03-03',
  changeType: 'promotion' as const,
  from: 'L4',
  to: 'L5',
  notes: 'Led the migration',
  ...overrides,
});

afterEach(() => vi.restoreAllMocks());

describe('createGrowthEntry', () => {
  it('stores a generated, timestamped entry in the private envelope and flushes', async () => {
    const { storage, data, flush } = createStorage();

    const entry = await createGrowthEntry(ALEX.id, input(), storage);

    expect(entry).toMatchObject({ engineerId: ALEX.id, date: '2025-03-03', from: 'L4', to: 'L5' });
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(entry.createdAt).toBe(entry.updatedAt);
    expect(data.get('growth')).toEqual([entry]);
    expect(flush).toHaveBeenCalledOnce();
  });

  it('trims text and strips control characters but keeps line breaks', async () => {
    const { storage } = createStorage();

    const entry = await createGrowthEntry(
      ALEX.id,
      input({ from: '  L4\u0000\u0007 ', notes: 'one\r\ntwo\u0001\tthree ' }),
      storage,
    );

    expect(entry.from).toBe('L4');
    expect(entry.notes).toBe('one\ntwothree');
  });

  it('accepts from, to and notes left empty', async () => {
    const { storage } = createStorage();

    const entry = await createGrowthEntry(ALEX.id, input({ from: '', to: '', notes: '' }), storage);

    expect(entry).toMatchObject({ from: '', to: '', notes: '' });
  });

  it.each([
    ['a missing date', { date: '' }],
    ['a malformed date', { date: '03/03/2025' }],
    ['an impossible date', { date: '2025-02-30' }],
    ['an unknown change type', { changeType: 'demotion' as never }],
    ['a from that is too long', { from: 'x'.repeat(GROWTH_TEXT_MAX_LENGTH + 1) }],
    ['a to that is not text', { to: 5 as never }],
    ['notes that are too long', { notes: 'x'.repeat(GROWTH_TEXT_MAX_LENGTH + 1) }],
  ])('rejects %s without writing and without echoing the text', async (_label, overrides) => {
    const { storage, data, flush } = createStorage();

    const result = createGrowthEntry(ALEX.id, input(overrides), storage);

    await expect(result).rejects.toBeInstanceOf(ValidationError);
    await expect(result).rejects.not.toThrow(/xxx/);
    expect(data.has('growth')).toBe(false);
    expect(flush).not.toHaveBeenCalled();
  });

  it('rejects a person who is not on the team', async () => {
    const { storage } = createStorage();

    await expect(createGrowthEntry('ghost', input(), storage)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('accepts exactly the maximum length', async () => {
    const { storage } = createStorage();

    const entry = await createGrowthEntry(
      ALEX.id,
      input({ notes: 'x'.repeat(GROWTH_TEXT_MAX_LENGTH) }),
      storage,
    );

    expect(entry.notes).toHaveLength(GROWTH_TEXT_MAX_LENGTH);
  });

  it('rolls memory back and rethrows when the encrypted write fails', async () => {
    const existing = buildEntry({ engineerId: ALEX.id });
    const failure = new StorageWriteError(true, true);
    const { storage, data } = createStorage({ growth: [existing] }, failure);

    await expect(createGrowthEntry(ALEX.id, input(), storage)).rejects.toBe(failure);

    expect(data.get('growth')).toEqual([existing]);
  });

  it('does not throw when the store locked while rolling back', async () => {
    const failure = new StorageWriteError(true, true);
    const { storage } = createStorage({}, failure);
    let calls = 0;
    storage.setPrivate = () => {
      if (++calls > 1) throw new Error('locked');
    };

    await expect(createGrowthEntry(ALEX.id, input(), storage)).rejects.toBe(failure);
  });
});

describe('getGrowthEntries', () => {
  it("returns only that person's entries, newest date first", () => {
    const old = buildEntry({ engineerId: ALEX.id, date: '2022-01-10' });
    const recent = buildEntry({ engineerId: ALEX.id, date: '2025-06-01' });
    const other = buildEntry({ engineerId: PRIYA.id, date: '2026-01-01' });
    const { storage } = createStorage({ growth: [old, other, recent] });

    expect(getGrowthEntries(storage, ALEX.id).map((entry) => entry.id)).toEqual([
      recent.id,
      old.id,
    ]);
  });

  it('shows the entry recorded last first when two share a day', () => {
    const first = buildEntry({
      engineerId: ALEX.id,
      date: '2025-03-03',
      createdAt: '2025-03-03T10:00:00.000Z',
    });
    const second = buildEntry({
      engineerId: ALEX.id,
      date: '2025-03-03',
      createdAt: '2025-03-03T10:05:00.000Z',
    });
    const third = buildEntry({
      engineerId: ALEX.id,
      date: '2025-03-03',
      createdAt: '2025-03-03T10:05:00.000Z',
    });
    const { storage } = createStorage({ growth: [first, second, third] });

    expect(getGrowthEntries(storage, ALEX.id).map((entry) => entry.id)).toEqual([
      third.id,
      second.id,
      first.id,
    ]);
  });

  it('skips malformed entries and warns with the id only', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const good = buildEntry({ engineerId: ALEX.id });
    const bad = { ...buildEntry({ engineerId: ALEX.id }), changeType: 'demotion', notes: 'SECRET' };
    const { storage } = createStorage({ growth: [bad, good, null, 'junk'] });

    expect(getGrowthEntries(storage, ALEX.id)).toEqual([good]);
    getGrowthEntries(storage, ALEX.id);

    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages).toContain(`Failed to parse growth entry ${bad.id}`);
    expect(messages).toContain('Failed to parse growth entry unknown');
    expect(messages.filter((message) => message.includes(bad.id))).toHaveLength(1);
    expect(messages.join(' ')).not.toContain('SECRET');
  });

  it('returns nothing when the stored value is not a list', () => {
    const { storage } = createStorage({ growth: 'nope' });

    expect(getGrowthEntries(storage, ALEX.id)).toEqual([]);
  });
});

describe('updateGrowthEntry', () => {
  it('changes the given fields, keeps the rest and refreshes updatedAt', async () => {
    const existing = buildEntry({
      engineerId: ALEX.id,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
    const { storage, data } = createStorage({ growth: [existing] });

    const updated = await updateGrowthEntry(
      existing.id,
      { from: 'L3', changeType: 'role_change', date: '2025-04-04', to: 'Tech Lead', notes: '' },
      storage,
    );

    expect(updated).toMatchObject({
      id: existing.id,
      engineerId: ALEX.id,
      from: 'L3',
      to: 'Tech Lead',
      notes: '',
      changeType: 'role_change',
      date: '2025-04-04',
      createdAt: existing.createdAt,
    });
    expect(updated.updatedAt).not.toBe(existing.updatedAt);
    expect(data.get('growth')).toEqual([updated]);
  });

  it('leaves untouched fields alone and ignores attempts to change id or person', async () => {
    const existing = buildEntry({ engineerId: ALEX.id });
    const { storage } = createStorage({ growth: [existing] });

    const updated = await updateGrowthEntry(
      existing.id,
      { notes: 'New', id: 'other', engineerId: PRIYA.id } as never,
      storage,
    );

    expect(updated).toMatchObject({
      id: existing.id,
      engineerId: ALEX.id,
      from: existing.from,
      to: existing.to,
      notes: 'New',
    });
  });

  it('rejects invalid values and unknown ids', async () => {
    const existing = buildEntry({ engineerId: ALEX.id });
    const { storage } = createStorage({ growth: [existing] });

    await expect(updateGrowthEntry(existing.id, { date: '' }, storage)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      updateGrowthEntry(existing.id, { changeType: 'x' as never }, storage),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(updateGrowthEntry('missing', { notes: 'x' }, storage)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('deleteGrowthEntry', () => {
  it('removes just that entry', async () => {
    const keep = buildEntry({ engineerId: ALEX.id });
    const drop = buildEntry({ engineerId: ALEX.id });
    const { storage, data } = createStorage({ growth: [keep, drop] });

    await deleteGrowthEntry(drop.id, storage);

    expect(data.get('growth')).toEqual([keep]);
  });

  it('rejects an unknown id', async () => {
    const { storage } = createStorage();

    await expect(deleteGrowthEntry('missing', storage)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('deleteGrowthForMember', () => {
  it("removes one person's entries and keeps everyone else's", async () => {
    const mine = buildEntry({ engineerId: ALEX.id });
    const theirs = buildEntry({ engineerId: PRIYA.id });
    const { storage, data } = createStorage({ growth: [mine, theirs] });

    await deleteGrowthForMember(ALEX.id, storage);

    expect(data.get('growth')).toEqual([theirs]);
  });
});

describe('isGrowthChangeType', () => {
  it('accepts the four change types only', () => {
    expect(
      ['promotion', 'role_change', 'team_transfer', 'title_update'].every(isGrowthChangeType),
    ).toBe(true);
    expect(isGrowthChangeType('demotion')).toBe(false);
    expect(isGrowthChangeType(undefined)).toBe(false);
  });
});
