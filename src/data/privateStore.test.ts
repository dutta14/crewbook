import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMember } from '../test-utils/factories';
import type { PrivateNote } from '../types/flightRisk';
import { StorageWriteError } from '../utils/encryptedStorage';
import { ValidationError } from './errors';
import {
  PRIVATE_NOTE_MAX_LENGTH,
  addPrivateNote,
  deletePrivateNotesForMember,
  getFlightRiskLevel,
  getPrivateNotes,
  isFlightRiskLevel,
  type PrivateNotesStorage,
} from './privateStore';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

function createStorage(
  privateData: Record<string, unknown> = {},
  failure: StorageWriteError | null = null,
) {
  const data = new Map<string, unknown>(Object.entries(privateData));
  const publicData = new Map<string, unknown>([['members', [ALEX, PRIYA]]]);
  const flush = vi.fn(async () => failure);
  const storage: PrivateNotesStorage = {
    get: <T>(key: string) => (publicData.has(key) ? (publicData.get(key) as T) : null),
    set: <T>(key: string, value: T) => void publicData.set(key, value),
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, flush, publicData };
}

const note = (overrides: Partial<PrivateNote> = {}): PrivateNote => ({
  id: crypto.randomUUID(),
  engineerId: ALEX.id,
  text: 'Recruiter reached out',
  flightRisk: 'medium',
  createdAt: '2025-03-03T10:00:00.000Z',
  ...overrides,
});

afterEach(() => vi.restoreAllMocks());

describe('addPrivateNote', () => {
  it('stores a timestamped note in the private envelope only and flushes', async () => {
    const { storage, data, publicData, flush } = createStorage();

    const saved = await addPrivateNote(ALEX.id, 'Asked about comp', 'high', storage);

    expect(saved).toMatchObject({
      engineerId: ALEX.id,
      text: 'Asked about comp',
      flightRisk: 'high',
    });
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false);
    expect(data.get('flightRisk')).toEqual([saved]);
    expect(JSON.stringify([...publicData.values()])).not.toContain('Asked about comp');
    expect(flush).toHaveBeenCalledOnce();
  });

  it('trims text and strips control characters but keeps line breaks', async () => {
    const { storage } = createStorage();

    const saved = await addPrivateNote(ALEX.id, '  one\r\ntwo\u0000\u0007 ', 'none', storage);

    expect(saved.text).toBe('one\ntwo');
  });

  it('keeps earlier notes when appending', async () => {
    const first = note();
    const { storage, data } = createStorage({ flightRisk: [first] });

    await addPrivateNote(ALEX.id, 'Second', 'low', storage);

    expect(data.get('flightRisk')).toHaveLength(2);
    expect((data.get('flightRisk') as PrivateNote[])[0]).toEqual(first);
  });

  it.each([
    ['empty text', { text: '' }],
    ['whitespace-only text', { text: '  \n\t ' }],
    ['text that is too long', { text: 'x'.repeat(PRIVATE_NOTE_MAX_LENGTH + 1) }],
    ['an unknown level', { level: 'severe' as never }],
    ['text that is not a string', { text: 5 as never }],
  ])('rejects %s without writing and without echoing the text', async (_label, overrides) => {
    const { storage, data, flush } = createStorage();
    const { text = 'ok', level = 'low' } = overrides as { text?: string; level?: never };

    const result = addPrivateNote(ALEX.id, text, level, storage);

    await expect(result).rejects.toBeInstanceOf(ValidationError);
    await expect(result).rejects.not.toThrow(/xxx/);
    expect(data.has('flightRisk')).toBe(false);
    expect(flush).not.toHaveBeenCalled();
  });

  it('accepts exactly the maximum length', async () => {
    const { storage } = createStorage();

    const saved = await addPrivateNote(
      ALEX.id,
      'x'.repeat(PRIVATE_NOTE_MAX_LENGTH),
      'none',
      storage,
    );

    expect(saved.text).toHaveLength(PRIVATE_NOTE_MAX_LENGTH);
  });

  it('rejects a person who is not on the team', async () => {
    const { storage } = createStorage();

    await expect(addPrivateNote('ghost', 'Hi', 'low', storage)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('rolls memory back and rethrows when the encrypted write fails', async () => {
    const existing = note();
    const failure = new StorageWriteError(true, true);
    const { storage, data } = createStorage({ flightRisk: [existing] }, failure);

    await expect(addPrivateNote(ALEX.id, 'New', 'high', storage)).rejects.toBe(failure);

    expect(data.get('flightRisk')).toEqual([existing]);
  });

  it('does not throw a second error when the store locked while rolling back', async () => {
    const failure = new StorageWriteError(true, true);
    const { storage } = createStorage({}, failure);
    let calls = 0;
    storage.setPrivate = () => {
      if (++calls > 1) throw new Error('locked');
    };

    await expect(addPrivateNote(ALEX.id, 'New', 'high', storage)).rejects.toBe(failure);
  });

  it('keeps every note when two are added at once', async () => {
    const { storage, data } = createStorage();

    await Promise.all([
      addPrivateNote(ALEX.id, 'One', 'low', storage),
      addPrivateNote(ALEX.id, 'Two', 'high', storage),
    ]);

    expect(data.get('flightRisk')).toHaveLength(2);
  });
});

describe('getPrivateNotes', () => {
  it('returns only that person’s notes, newest first', () => {
    const { storage } = createStorage({
      flightRisk: [
        note({ id: 'a', text: 'old', createdAt: '2025-01-01T00:00:00.000Z' }),
        note({ id: 'b', engineerId: PRIYA.id, text: 'hers' }),
        note({ id: 'c', text: 'new', createdAt: '2025-02-01T00:00:00.000Z' }),
      ],
    });

    expect(getPrivateNotes(storage, ALEX.id).map((item) => item.id)).toEqual(['c', 'a']);
  });

  it('puts the later of two notes with the same timestamp on top', () => {
    const { storage } = createStorage({
      flightRisk: [note({ id: 'first' }), note({ id: 'second' })],
    });

    expect(getPrivateNotes(storage, ALEX.id).map((item) => item.id)).toEqual(['second', 'first']);
  });

  it('ignores malformed stored records and a non-array value', () => {
    const { storage } = createStorage({ flightRisk: [{ id: 1 }, null, note({ id: 'ok' })] });

    expect(getPrivateNotes(storage, ALEX.id).map((item) => item.id)).toEqual(['ok']);
    expect(getPrivateNotes(createStorage({ flightRisk: 'nope' }).storage, ALEX.id)).toEqual([]);
  });

  it('returns copies, so callers cannot edit stored notes', () => {
    const { storage, data } = createStorage({ flightRisk: [note({ id: 'a' })] });

    getPrivateNotes(storage, ALEX.id)[0].text = 'changed';

    expect((data.get('flightRisk') as PrivateNote[])[0].text).toBe('Recruiter reached out');
  });
});

describe('getFlightRiskLevel', () => {
  it('is none without notes or while the private envelope is closed', () => {
    expect(getFlightRiskLevel(createStorage().storage, ALEX.id)).toBe('none');
  });

  it('follows the latest note, and a none note resets it', () => {
    const { storage } = createStorage({
      flightRisk: [
        note({ flightRisk: 'high', createdAt: '2025-01-01T00:00:00.000Z' }),
        note({ flightRisk: 'none', createdAt: '2025-02-01T00:00:00.000Z' }),
      ],
    });

    expect(getFlightRiskLevel(storage, ALEX.id)).toBe('none');
  });

  it('does not take another person’s level', () => {
    const { storage } = createStorage({
      flightRisk: [note({ engineerId: PRIYA.id, flightRisk: 'high' })],
    });

    expect(getFlightRiskLevel(storage, ALEX.id)).toBe('none');
  });
});

describe('deletePrivateNotesForMember', () => {
  it('removes only that person’s notes and flushes', async () => {
    const hers = note({ engineerId: PRIYA.id });
    const { storage, data, flush } = createStorage({ flightRisk: [note(), hers] });

    await deletePrivateNotesForMember(ALEX.id, storage);

    expect(data.get('flightRisk')).toEqual([hers]);
    expect(flush).toHaveBeenCalledOnce();
  });

  it('leaves other people’s notes alone when the member has none', async () => {
    const hers = note({ engineerId: PRIYA.id });
    const { storage, data } = createStorage({ flightRisk: [hers] });

    await deletePrivateNotesForMember(ALEX.id, storage);

    expect(data.get('flightRisk')).toEqual([hers]);
  });
});

describe('isFlightRiskLevel', () => {
  it('accepts the four levels only', () => {
    expect(['none', 'low', 'medium', 'high'].every(isFlightRiskLevel)).toBe(true);
    expect(isFlightRiskLevel('critical')).toBe(false);
    expect(isFlightRiskLevel(undefined)).toBe(false);
  });
});
