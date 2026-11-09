import { describe, expect, it, vi } from 'vitest';
import { createLeave as buildLeave, createMember } from '../test-utils/factories';
import { StorageWriteError } from '../utils/encryptedStorage';
import { NotFoundError, ValidationError } from './errors';
import {
  createLeave,
  deleteLeave,
  deleteLeaveForMember,
  getLeave,
  isLeaveType,
  leaveCoversDay,
  leaveOverlapsRange,
  peopleOutOn,
  updateLeave,
  type LeaveStorage,
} from './leave';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

function createStorage(
  privateData: Record<string, unknown> = {},
  failure: StorageWriteError | null = null,
) {
  const data = new Map<string, unknown>(Object.entries(privateData));
  const publicData = new Map<string, unknown>([['members', [ALEX, PRIYA]]]);
  const flush = vi.fn(async () => failure);
  const storage: LeaveStorage = {
    get: <T>(key: string) => (publicData.has(key) ? (publicData.get(key) as T) : null),
    set: <T>(key: string, value: T) => void publicData.set(key, value),
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, flush };
}

const input = {
  memberId: ALEX.id,
  type: 'sick' as const,
  startDate: '2026-06-15',
  endDate: '2026-06-17',
};

describe('createLeave', () => {
  it('stores the entry in the private envelope and forces the write', async () => {
    const { storage, data, flush } = createStorage();

    const entry = await createLeave(input, storage);

    expect(entry).toMatchObject(input);
    expect(entry.id).toBeTruthy();
    expect(data.get('leave')).toEqual([entry]);
    expect(flush).toHaveBeenCalledOnce();
  });

  it('accepts a single day', async () => {
    const { storage } = createStorage();

    await expect(
      createLeave({ ...input, endDate: input.startDate }, storage),
    ).resolves.toBeTruthy();
  });

  it.each([
    ['a person who is not on the team', { memberId: 'ghost' }],
    ['an unknown type', { type: 'sabbatical' as never }],
    ['an impossible date', { startDate: '2026-02-30' }],
    ['a date in free text', { endDate: 'tomorrow' }],
    ['a year out of range', { startDate: '1800-01-01', endDate: '1800-01-02' }],
    ['an end before the start', { startDate: '2026-06-17', endDate: '2026-06-15' }],
  ])('rejects %s without writing', async (_label, override) => {
    const { storage, data, flush } = createStorage();

    await expect(createLeave({ ...input, ...override }, storage)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(data.has('leave')).toBe(false);
    expect(flush).not.toHaveBeenCalled();
  });

  it('rolls back and rethrows when the write fails', async () => {
    const failure = new StorageWriteError(false, true);
    const { storage, data } = createStorage({ leave: [] }, failure);

    await expect(createLeave(input, storage)).rejects.toBe(failure);
    expect(data.get('leave')).toEqual([]);
  });

  it('keeps concurrent writes in order', async () => {
    const { storage } = createStorage();

    await Promise.all([
      createLeave(input, storage),
      createLeave({ ...input, memberId: PRIYA.id, startDate: '2026-06-16' }, storage),
    ]);

    expect(getLeave(storage).map((entry) => entry.memberId)).toEqual([ALEX.id, PRIYA.id]);
  });
});

describe('updateLeave', () => {
  it('changes the fields and keeps the id and creation time', async () => {
    const existing = buildLeave({ memberId: ALEX.id });
    const { storage, data } = createStorage({ leave: [existing] });

    const updated = await updateLeave(
      existing.id,
      { ...input, memberId: PRIYA.id, type: 'parental' },
      storage,
    );

    expect(updated).toMatchObject({
      id: existing.id,
      createdAt: existing.createdAt,
      memberId: PRIYA.id,
      type: 'parental',
    });
    expect(data.get('leave')).toEqual([updated]);
  });

  it('throws NotFoundError for an unknown id', async () => {
    const { storage } = createStorage({ leave: [] });

    await expect(updateLeave('missing', input, storage)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects invalid input and leaves the entry as it was', async () => {
    const existing = buildLeave({ memberId: ALEX.id });
    const { storage, data } = createStorage({ leave: [existing] });

    await expect(
      updateLeave(existing.id, { ...input, endDate: '2000-01-01' }, storage),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(data.get('leave')).toEqual([existing]);
  });
});

describe('deleteLeave', () => {
  it('removes only that entry', async () => {
    const keep = buildLeave({ memberId: ALEX.id });
    const drop = buildLeave({ memberId: PRIYA.id });
    const { storage, data } = createStorage({ leave: [keep, drop] });

    await deleteLeave(drop.id, storage);

    expect(data.get('leave')).toEqual([keep]);
  });

  it('throws NotFoundError for an unknown id', async () => {
    const { storage } = createStorage({ leave: [] });

    await expect(deleteLeave('missing', storage)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('restores the entry when the write fails', async () => {
    const entry = buildLeave({ memberId: ALEX.id });
    const failure = new StorageWriteError(false, true);
    const { storage, data } = createStorage({ leave: [entry] }, failure);

    await expect(deleteLeave(entry.id, storage)).rejects.toBe(failure);
    expect(data.get('leave')).toEqual([entry]);
  });
});

describe('deleteLeaveForMember', () => {
  it('purges every entry for the member and keeps the rest', async () => {
    const alexOne = buildLeave({ memberId: ALEX.id });
    const alexTwo = buildLeave({ memberId: ALEX.id });
    const priya = buildLeave({ memberId: PRIYA.id });
    const { storage, data } = createStorage({ leave: [alexOne, priya, alexTwo] });

    await deleteLeaveForMember(ALEX.id, storage);

    expect(data.get('leave')).toEqual([priya]);
  });
});

describe('getLeave', () => {
  it('returns entries earliest first and ignores malformed ones', () => {
    const later = buildLeave({ startDate: '2026-07-01', endDate: '2026-07-02' });
    const earlier = buildLeave({ startDate: '2026-06-01', endDate: '2026-06-02' });
    const { storage } = createStorage({
      leave: [later, { id: 1 }, null, { ...earlier, type: 'bogus' }, earlier],
    });

    expect(getLeave(storage)).toEqual([earlier, later]);
  });

  it('returns nothing when the key is missing or not a list', () => {
    expect(getLeave(createStorage().storage)).toEqual([]);
    expect(getLeave(createStorage({ leave: 'oops' }).storage)).toEqual([]);
  });
});

describe('date helpers', () => {
  const entry = buildLeave({ startDate: '2026-06-15', endDate: '2026-06-17' });

  it('covers both ends of the range inclusively', () => {
    expect(leaveCoversDay(entry, '2026-06-14')).toBe(false);
    expect(leaveCoversDay(entry, '2026-06-15')).toBe(true);
    expect(leaveCoversDay(entry, '2026-06-17')).toBe(true);
    expect(leaveCoversDay(entry, '2026-06-18')).toBe(false);
  });

  it('detects overlap with a range', () => {
    expect(leaveOverlapsRange(entry, '2026-06-17', '2026-06-23')).toBe(true);
    expect(leaveOverlapsRange(entry, '2026-06-18', '2026-06-23')).toBe(false);
    expect(leaveOverlapsRange(entry, '2026-06-08', '2026-06-14')).toBe(false);
  });

  it('counts each person once per day', () => {
    const entries = [
      buildLeave({ memberId: 'a', startDate: '2026-06-15', endDate: '2026-06-15' }),
      buildLeave({ memberId: 'a', startDate: '2026-06-15', endDate: '2026-06-16' }),
      buildLeave({ memberId: 'b', startDate: '2026-06-15', endDate: '2026-06-15' }),
    ];

    expect(peopleOutOn(entries, '2026-06-15')).toEqual(['a', 'b']);
    expect(peopleOutOn(entries, '2026-06-16')).toEqual(['a']);
  });

  it('recognises only the four leave types', () => {
    expect(isLeaveType('pto')).toBe(true);
    expect(isLeaveType('vacation')).toBe(false);
    expect(isLeaveType(3)).toBe(false);
  });
});
