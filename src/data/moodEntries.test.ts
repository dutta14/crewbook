import { beforeEach, describe, expect, it } from 'vitest';
import type { StorageWriteError } from '../utils/encryptedStorage';
import { createMoodEntry } from '../test-utils/factories';
import { ValidationError } from './errors';
import {
  addMoodEntry,
  deleteMoodEntriesForMember,
  deleteMoodEntry,
  listMoodEntries,
  type MoodStorage,
} from './moodEntries';

const ALEX = 'alex';
const PRIYA = 'priya';

function createStorage(initial: unknown = [], flushFailure: StorageWriteError | null = null) {
  const store = new Map<string, unknown>([['moods', initial]]);
  const storage: MoodStorage & { failWith: StorageWriteError | null } = {
    failWith: flushFailure,
    getPrivate: <T>(key: string) => (store.has(key) ? (store.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void store.set(key, value),
    flush: async () => storage.failWith,
  };
  return { storage, store };
}

describe('moodEntries', () => {
  let ctx: ReturnType<typeof createStorage>;
  beforeEach(() => {
    ctx = createStorage();
  });

  it('stores an entry under the moods property with a note link', async () => {
    const entry = await addMoodEntry({ memberId: ALEX, noteId: 'n1', score: 4 }, ctx.storage);

    expect(entry).toMatchObject({ memberId: ALEX, noteId: 'n1', score: 4 });
    expect(Date.parse(entry.recordedAt)).not.toBeNaN();
    expect(ctx.store.get('moods')).toEqual([entry]);
  });

  it('replaces the earlier rating for the same note', async () => {
    await addMoodEntry({ memberId: ALEX, noteId: 'n1', score: 2 }, ctx.storage);
    await addMoodEntry({ memberId: ALEX, noteId: 'n1', score: 5 }, ctx.storage);

    expect(listMoodEntries(ALEX, ctx.storage).map((e) => e.score)).toEqual([5]);
  });

  it.each([0, 6, 3.5, NaN, '3', null])('rejects the score %s', async (score) => {
    await expect(
      addMoodEntry({ memberId: ALEX, noteId: 'n1', score: score as never }, ctx.storage),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(ctx.store.get('moods')).toEqual([]);
  });

  it('rejects a missing member or note', async () => {
    await expect(
      addMoodEntry({ memberId: '', noteId: 'n1', score: 3 }, ctx.storage),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      addMoodEntry({ memberId: ALEX, noteId: '', score: 3 }, ctx.storage),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('lists one member’s last 12 entries oldest first', async () => {
    const entries = Array.from({ length: 14 }, (_, index) =>
      createMoodEntry({
        memberId: ALEX,
        recordedAt: new Date(Date.UTC(2025, 0, index + 1)).toISOString(),
      }),
    );
    ctx = createStorage([
      ...entries.slice().reverse(),
      createMoodEntry({ memberId: PRIYA, recordedAt: '2025-02-01T00:00:00.000Z' }),
    ]);

    const listed = listMoodEntries(ALEX, ctx.storage);

    expect(listed.map((e) => e.id)).toEqual(entries.slice(2).map((e) => e.id));
    expect(listMoodEntries(ALEX, ctx.storage, 3)).toHaveLength(3);
    expect(listMoodEntries(ALEX, ctx.storage, 0)).toEqual([]);
  });

  it('ignores malformed stored values', () => {
    ctx = createStorage([{ id: 'x', memberId: ALEX, noteId: 'n', score: 9, recordedAt: 'now' }, 7]);

    expect(listMoodEntries(ALEX, ctx.storage)).toEqual([]);
    expect(listMoodEntries(ALEX, createStorage('nope').storage)).toEqual([]);
  });

  it('deletes the rating for a note and leaves others', async () => {
    await addMoodEntry({ memberId: ALEX, noteId: 'n1', score: 2 }, ctx.storage);
    await addMoodEntry({ memberId: ALEX, noteId: 'n2', score: 3 }, ctx.storage);

    await deleteMoodEntry('n1', ctx.storage);
    await deleteMoodEntry('unknown', ctx.storage);

    expect(listMoodEntries(ALEX, ctx.storage).map((e) => e.noteId)).toEqual(['n2']);
  });

  it('purges every rating for a member', async () => {
    await addMoodEntry({ memberId: ALEX, noteId: 'n1', score: 2 }, ctx.storage);
    await addMoodEntry({ memberId: PRIYA, noteId: 'n2', score: 3 }, ctx.storage);

    await deleteMoodEntriesForMember(ALEX, ctx.storage);

    expect(listMoodEntries(ALEX, ctx.storage)).toEqual([]);
    expect(listMoodEntries(PRIYA, ctx.storage)).toHaveLength(1);
  });

  it('rolls back and rethrows when the write fails', async () => {
    const failure = new Error('disk full') as StorageWriteError;
    ctx.storage.failWith = failure;

    await expect(
      addMoodEntry({ memberId: ALEX, noteId: 'n1', score: 4 }, ctx.storage),
    ).rejects.toBe(failure);

    expect(ctx.store.get('moods')).toEqual([]);
  });
});
