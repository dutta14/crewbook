import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFeedback, createMember } from '../test-utils/factories';
import { toIsoDate } from '../utils/scheduleCalculator';
import { StorageWriteError } from '../utils/encryptedStorage';
import { NotFoundError, ValidationError } from './errors';
import {
  FEEDBACK_MAX_TAGS,
  FEEDBACK_TAG_MAX_LENGTH,
  FEEDBACK_TEXT_MAX_LENGTH,
  createFeedbackEntry,
  deleteFeedbackEntry,
  deleteFeedbackForMember,
  getFeedbackCount,
  getFeedbackEntries,
  getPromoPacketEntries,
  isFeedbackType,
  normalizeTags,
  updateFeedbackEntry,
  type FeedbackStorage,
} from './feedbackStore';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

function createStorage(
  privateData: Record<string, unknown> = {},
  failure: StorageWriteError | null = null,
) {
  const data = new Map<string, unknown>(Object.entries(privateData));
  const publicData = new Map<string, unknown>([['members', [ALEX, PRIYA]]]);
  const flush = vi.fn(async () => failure);
  const storage: FeedbackStorage = {
    get: <T>(key: string) => (publicData.has(key) ? (publicData.get(key) as T) : null),
    set: <T>(key: string, value: T) => void publicData.set(key, value),
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, flush };
}

const input = (overrides: Partial<Parameters<typeof createFeedbackEntry>[0]> = {}) => ({
  engineerId: ALEX.id,
  date: '2025-03-03',
  type: 'positive' as const,
  text: 'Ran the incident review calmly',
  tags: ['leadership'],
  ...overrides,
});

afterEach(() => vi.restoreAllMocks());

describe('createFeedbackEntry', () => {
  it('stores a generated, timestamped entry in the private envelope and flushes', async () => {
    const { storage, data, flush } = createStorage();

    const entry = await createFeedbackEntry(input(), storage);

    expect(entry).toMatchObject({ engineerId: ALEX.id, type: 'positive', tags: ['leadership'] });
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(entry.createdAt).toBe(entry.updatedAt);
    expect(data.get('feedback')).toEqual([entry]);
    expect(flush).toHaveBeenCalledOnce();
  });

  it('trims text and strips control characters but keeps line breaks', async () => {
    const { storage } = createStorage();

    const entry = await createFeedbackEntry(
      input({ text: '  one\u0000\u0007\ntwo\u0001  ' }),
      storage,
    );

    expect(entry.text).toBe('one\ntwo');
  });

  it('stores text that looks like markup as it is', async () => {
    const { storage } = createStorage();

    const entry = await createFeedbackEntry(
      input({ text: '<img src=x onerror=alert(1)>' }),
      storage,
    );

    expect(entry.text).toBe('<img src=x onerror=alert(1)>');
  });

  it('accepts today but not tomorrow', async () => {
    const { storage } = createStorage();
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    await expect(
      createFeedbackEntry(input({ date: toIsoDate(today) }), storage),
    ).resolves.toBeTruthy();
    await expect(
      createFeedbackEntry(input({ date: toIsoDate(tomorrow) }), storage),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it.each([
    ['an unknown person', { engineerId: 'nobody' }],
    ['a missing date', { date: '' }],
    ['an impossible date', { date: '2025-02-30' }],
    ['an unknown type', { type: 'harsh' as never }],
    ['empty text', { text: '   ' }],
    ['text that is not a string', { text: 5 as never }],
    ['text that is too long', { text: 'x'.repeat(FEEDBACK_TEXT_MAX_LENGTH + 1) }],
    ['a tag with markup', { tags: ['<b>'] }],
    ['a tag with a space', { tags: ['two words'] }],
    ['a tag that is too long', { tags: ['x'.repeat(FEEDBACK_TAG_MAX_LENGTH + 1)] }],
    ['tags that are not a list', { tags: 'a' as never }],
  ])('rejects %s without writing and without echoing the text', async (_label, overrides) => {
    const { storage, data, flush } = createStorage();
    const secret = 'confidential-observation';

    const failure = await createFeedbackEntry(input({ text: secret, ...overrides }), storage).then(
      () => null,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(ValidationError);
    expect((failure as Error).message).not.toContain(secret);
    expect(data.has('feedback')).toBe(false);
    expect(flush).not.toHaveBeenCalled();
  });

  it('rolls back and rethrows when the write fails', async () => {
    const failure = new StorageWriteError(true, true);
    const existing = createFeedback({ engineerId: ALEX.id });
    const { storage, data } = createStorage({ feedback: [existing] }, failure);

    await expect(createFeedbackEntry(input(), storage)).rejects.toBe(failure);

    expect(data.get('feedback')).toEqual([existing]);
  });

  it('keeps concurrent writes in order', async () => {
    const { storage, data } = createStorage();

    await Promise.all([
      createFeedbackEntry(input({ text: 'first' }), storage),
      createFeedbackEntry(input({ text: 'second' }), storage),
    ]);

    expect((data.get('feedback') as Array<{ text: string }>).map((item) => item.text)).toEqual([
      'first',
      'second',
    ]);
  });
});

describe('normalizeTags', () => {
  it('trims, lower-cases and de-duplicates', () => {
    expect(normalizeTags([' Leadership ', 'leadership', 'Mentoring', ''])).toEqual([
      'leadership',
      'mentoring',
    ]);
  });

  it('silently keeps only the first ten', () => {
    const tags = Array.from({ length: FEEDBACK_MAX_TAGS + 3 }, (_, index) => `tag-${index}`);

    expect(normalizeTags(tags)).toEqual(tags.slice(0, FEEDBACK_MAX_TAGS));
  });

  it('rejects a tag that is not text', () => {
    expect(() => normalizeTags([5])).toThrow(ValidationError);
  });
});

describe('updateFeedbackEntry', () => {
  it('changes only the given fields and bumps updatedAt', async () => {
    const existing = createFeedback({
      engineerId: ALEX.id,
      text: 'before',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
    const { storage } = createStorage({ feedback: [existing] });

    const updated = await updateFeedbackEntry(
      existing.id,
      { text: 'after', type: 'neutral' },
      storage,
    );

    expect(updated).toMatchObject({
      id: existing.id,
      text: 'after',
      type: 'neutral',
      date: existing.date,
    });
    expect(updated.updatedAt).not.toBe(existing.updatedAt);
    expect(updated.createdAt).toBe(existing.createdAt);
  });

  it('can move an entry to another person', async () => {
    const existing = createFeedback({ engineerId: ALEX.id });
    const { storage } = createStorage({ feedback: [existing] });

    await updateFeedbackEntry(existing.id, { engineerId: PRIYA.id }, storage);

    expect(getFeedbackCount(storage, PRIYA.id)).toBe(1);
    expect(getFeedbackCount(storage, ALEX.id)).toBe(0);
  });

  it('rejects an unknown id and invalid values', async () => {
    const existing = createFeedback({ engineerId: ALEX.id });
    const { storage, flush } = createStorage({ feedback: [existing] });

    await expect(updateFeedbackEntry('missing', { text: 'x' }, storage)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(updateFeedbackEntry(existing.id, { text: '' }, storage)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(flush).not.toHaveBeenCalled();
  });

  it('rolls back when the write fails', async () => {
    const failure = new StorageWriteError(true, true);
    const existing = createFeedback({ engineerId: ALEX.id, text: 'before' });
    const { storage, data } = createStorage({ feedback: [existing] }, failure);

    await expect(updateFeedbackEntry(existing.id, { text: 'after' }, storage)).rejects.toBe(
      failure,
    );

    expect(data.get('feedback')).toEqual([existing]);
  });
});

describe('deleteFeedbackEntry and deleteFeedbackForMember', () => {
  it('removes one entry and rejects an unknown id', async () => {
    const keep = createFeedback({ engineerId: ALEX.id });
    const drop = createFeedback({ engineerId: ALEX.id });
    const { storage } = createStorage({ feedback: [keep, drop] });

    await deleteFeedbackEntry(drop.id, storage);

    expect(getFeedbackEntries(storage)).toEqual([keep]);
    await expect(deleteFeedbackEntry(drop.id, storage)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('purges every entry for a member and leaves others', async () => {
    const theirs = createFeedback({ engineerId: PRIYA.id });
    const { storage } = createStorage({
      feedback: [
        createFeedback({ engineerId: ALEX.id }),
        createFeedback({ engineerId: ALEX.id }),
        theirs,
      ],
    });

    await deleteFeedbackForMember(ALEX.id, storage);

    expect(getFeedbackEntries(storage)).toEqual([theirs]);
  });
});

describe('reading', () => {
  it('returns entries newest first, then most recently logged first', () => {
    const { storage } = createStorage({
      feedback: [
        createFeedback({ id: 'old', date: '2025-01-01' }),
        createFeedback({ id: 'late', date: '2025-03-03', createdAt: '2025-03-04T10:00:00.000Z' }),
        createFeedback({ id: 'early', date: '2025-03-03', createdAt: '2025-03-03T10:00:00.000Z' }),
      ],
    });

    expect(getFeedbackEntries(storage).map((item) => item.id)).toEqual(['late', 'early', 'old']);
  });

  it('applies filters', () => {
    const { storage } = createStorage({
      feedback: [
        createFeedback({ id: 'a', engineerId: ALEX.id, type: 'positive' }),
        createFeedback({ id: 'b', engineerId: PRIYA.id, type: 'constructive' }),
      ],
    });

    expect(getFeedbackEntries(storage, { type: 'constructive' }).map((item) => item.id)).toEqual([
      'b',
    ]);
  });

  it('returns copies so callers cannot change the store', () => {
    const { storage, data } = createStorage({ feedback: [createFeedback({ tags: ['a'] })] });

    getFeedbackEntries(storage)[0].tags.push('b');

    expect((data.get('feedback') as Array<{ tags: string[] }>)[0].tags).toEqual(['a']);
  });

  it('reads nothing when the envelope is not loaded', () => {
    const { storage } = createStorage();

    expect(getFeedbackEntries(storage)).toEqual([]);
    expect(getFeedbackCount(storage, ALEX.id)).toBe(0);
  });

  it('skips malformed records and warns once per id without logging content', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const good = createFeedback({ engineerId: ALEX.id });
    const { storage } = createStorage({
      feedback: [
        good,
        { id: 'bad-1', engineerId: ALEX.id, text: 'secret words', type: 'nope' },
        null,
      ],
    });

    expect(getFeedbackEntries(storage)).toEqual([good]);
    getFeedbackEntries(storage);

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.flat().join(' ')).not.toContain('secret words');
  });

  it('recognises feedback types', () => {
    expect(isFeedbackType('neutral')).toBe(true);
    expect(isFeedbackType('rude')).toBe(false);
    expect(isFeedbackType(undefined)).toBe(false);
  });
});

describe('getPromoPacketEntries', () => {
  const entries = [
    createFeedback({ id: 'p-march', engineerId: ALEX.id, type: 'positive', date: '2025-03-10' }),
    createFeedback({ id: 'p-jan', engineerId: ALEX.id, type: 'positive', date: '2025-01-10' }),
    createFeedback({ id: 'c', engineerId: ALEX.id, type: 'constructive', date: '2025-02-10' }),
    createFeedback({ id: 'n', engineerId: ALEX.id, type: 'neutral', date: '2025-02-11' }),
    createFeedback({ id: 'other', engineerId: PRIYA.id, type: 'positive', date: '2025-02-12' }),
    createFeedback({ id: 'p-out', engineerId: ALEX.id, type: 'positive', date: '2024-12-31' }),
  ];

  it('returns only that person’s positive entries in the range, oldest first', () => {
    const { storage } = createStorage({ feedback: entries });

    const packet = getPromoPacketEntries(storage, ALEX.id, {
      start: '2025-01-01',
      end: '2025-03-31',
    });

    expect(packet.map((item) => item.id)).toEqual(['p-jan', 'p-march']);
  });

  it('includes entries on the first and last day of the range', () => {
    const { storage } = createStorage({ feedback: entries });

    const packet = getPromoPacketEntries(storage, ALEX.id, {
      start: '2025-01-10',
      end: '2025-03-10',
    });

    expect(packet.map((item) => item.id)).toEqual(['p-jan', 'p-march']);
  });

  it('returns nothing without a person or a valid range', () => {
    const { storage } = createStorage({ feedback: entries });

    expect(getPromoPacketEntries(storage, '', { start: '2025-01-01', end: '2025-03-31' })).toEqual(
      [],
    );
    expect(getPromoPacketEntries(storage, ALEX.id, { start: '', end: '2025-03-31' })).toEqual([]);
    expect(getPromoPacketEntries(storage, ALEX.id, { start: '2025-01-01', end: 'soon' })).toEqual(
      [],
    );
  });
});
