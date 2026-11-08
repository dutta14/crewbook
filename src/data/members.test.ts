import { afterEach, describe, expect, it, vi } from 'vitest';
import { StorageManager } from './StorageManager';
import { createMember } from '../test-utils/factories';
import { STORAGE_DATA_KEY, StorageWriteError } from '../utils/encryptedStorage';
import type { TeamMemberInput } from '../types';
import { NotFoundError, ValidationError } from './errors';
import {
  addMember,
  deleteMember,
  getMember,
  isTeamMemberStatus,
  listMembers,
  updateMember,
  type MemberStorage,
} from './members';

vi.mock('../utils/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/crypto')>();
  const { fastDeriveKey: fast } = await import('../test-utils/fastCrypto');
  return { ...actual, deriveKey: fast };
});

const PASSPHRASE = 'correct horse battery staple';

function asStorage(manager: StorageManager): MemberStorage {
  return {
    get: <T>(key: string) => manager.getData<T>(key),
    set: (key, value) => manager.setData(key, value),
    flush: () => manager.flush(),
  };
}

async function createStorage() {
  const manager = new StorageManager();
  await manager.setup(PASSPHRASE);
  return { manager, storage: asStorage(manager) };
}

function input(overrides: Partial<TeamMemberInput> = {}): TeamMemberInput {
  const { id, createdAt, updatedAt, ...rest } = createMember();
  void [id, createdAt, updatedAt];
  return { ...rest, ...overrides };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('addMember', () => {
  it('creates a member with generated id, createdAt, updatedAt', async () => {
    const { storage } = await createStorage();

    const member = await addMember(input({ name: 'Priya Nair' }), storage);

    expect(member.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(member.name).toBe('Priya Nair');
    expect(new Date(member.createdAt).toISOString()).toBe(member.createdAt);
    expect(member.updatedAt).toBe(member.createdAt);
    expect(getMember(member.id, storage)).toEqual(member);
  });

  it('validates name is required', async () => {
    const { storage } = await createStorage();

    await expect(
      addMember(input({ name: undefined as unknown as string }), storage),
    ).rejects.toThrow(new ValidationError('Name is required'));
    expect(listMembers(storage)).toEqual([]);
  });

  it('rejects an empty or whitespace-only name', async () => {
    const { storage } = await createStorage();

    await expect(addMember(input({ name: '' }), storage)).rejects.toThrow('Name is required');
    await expect(addMember(input({ name: '   ' }), storage)).rejects.toThrow('Name is required');
  });

  it('trims text fields and drops properties it does not know', async () => {
    const { storage } = await createStorage();
    const extra = {
      ...input({ name: '  Sam  ', role: ' EM ', level: ' L6 ', email: ' s@x.io ' }),
      admin: true,
    };

    const member = await addMember(extra, storage);

    expect(member).toMatchObject({ name: 'Sam', role: 'EM', level: 'L6', email: 's@x.io' });
    expect(member).not.toHaveProperty('admin');
  });

  it.each([
    ['a name with an HTML tag', { name: 'Sam <b>Bold</b>' }, 'Name must not contain HTML'],
    [
      'a name over 200 characters',
      { name: 'a'.repeat(201) },
      'Name must be 200 characters or fewer',
    ],
    ['a role with a script tag', { role: '<script>x</script>' }, 'Role must not contain HTML'],
    ['an invalid email', { email: 'not-an-email' }, 'Email is not valid'],
    ['an invalid status', { status: 'fired' as never }, 'Status is not valid'],
    ['a calendar date that does not exist', { startDate: '2023-02-31' }, 'Start date must be'],
    ['a start date before 1970', { startDate: '1969-12-31' }, 'Start date must be'],
    ['a start date after 2100', { startDate: '2101-01-01' }, 'Start date must be'],
    ['a start date that is not ISO 8601', { startDate: '03/13/2023' }, 'Start date must be'],
    [
      'a manager that does not exist',
      { manager: crypto.randomUUID() },
      'Manager must be an existing member',
    ],
    ['a javascript: avatar URL', { avatarUrl: 'javascript:alert(1)' }, 'Avatar URL is not valid'],
  ])('rejects %s', async (_label, overrides, message) => {
    const { storage } = await createStorage();

    await expect(addMember(input(overrides), storage)).rejects.toThrow(message);
    expect(listMembers(storage)).toEqual([]);
  });

  it('accepts an empty email, a date-time start date and an https avatar', async () => {
    const { storage } = await createStorage();

    const member = await addMember(
      input({
        email: '',
        startDate: '2024-05-01T09:30:00+02:00',
        avatarUrl: 'https://example.com/a.png',
      }),
      storage,
    );

    expect(member).toMatchObject({ email: '', avatarUrl: 'https://example.com/a.png' });
  });

  it('accepts an existing member as manager', async () => {
    const { storage } = await createStorage();
    const boss = await addMember(input({ name: 'Boss' }), storage);

    const report = await addMember(input({ name: 'Report', manager: boss.id }), storage);

    expect(report.manager).toBe(boss.id);
  });
});

describe('customFields validation', () => {
  it.each([
    ['__proto__', 'x'],
    ['constructor', 'x'],
    ['prototype', 'x'],
    ['__private', 'x'],
    ['has space', 'x'],
    ['a'.repeat(51), 'x'],
    ['', 'x'],
  ])('rejects the key %j', async (key, value) => {
    const { storage } = await createStorage();

    await expect(addMember(input({ customFields: { [key]: value } }), storage)).rejects.toThrow(
      'A custom field name is not allowed',
    );
  });

  it('rejects a __proto__ key created by JSON.parse without touching Object.prototype', async () => {
    const { storage } = await createStorage();
    const customFields = JSON.parse('{"__proto__": "x"}') as Record<string, string>;

    await expect(addMember(input({ customFields }), storage)).rejects.toThrow(ValidationError);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects values that are too long, not text or contain HTML', async () => {
    const { storage } = await createStorage();

    await expect(
      addMember(input({ customFields: { a: 'x'.repeat(1001) } }), storage),
    ).rejects.toThrow('1000 characters');
    await expect(
      addMember(input({ customFields: { a: 5 as unknown as string } }), storage),
    ).rejects.toThrow('must be text');
    await expect(addMember(input({ customFields: { a: '<img src=x>' } }), storage)).rejects.toThrow(
      'must not contain HTML',
    );
  });

  it('allows 20 custom fields and rejects 21', async () => {
    const { storage } = await createStorage();
    const fields = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_, index) => [`field-${index}`, 'v']));

    await expect(addMember(input({ customFields: fields(20) }), storage)).resolves.toBeDefined();
    await expect(addMember(input({ customFields: fields(21) }), storage)).rejects.toThrow(
      'At most 20 custom fields',
    );
  });

  it('rejects custom fields that are not a plain object', async () => {
    const { storage } = await createStorage();

    await expect(
      addMember(input({ customFields: ['a'] as unknown as Record<string, string> }), storage),
    ).rejects.toThrow('Custom fields must be an object');
  });
});

describe('getMember', () => {
  it('returns member by id', async () => {
    const { storage } = await createStorage();
    const first = await addMember(input({ name: 'First' }), storage);
    await addMember(input({ name: 'Second' }), storage);

    expect(getMember(first.id, storage)).toEqual(first);
  });

  it('returns null for nonexistent id', async () => {
    const { storage } = await createStorage();

    expect(getMember(crypto.randomUUID(), storage)).toBeNull();
  });

  it('returns a copy, so edits to it do not change the stored member', async () => {
    const { storage } = await createStorage();
    const added = await addMember(input({ name: 'Original' }), storage);

    const fetched = getMember(added.id, storage);
    if (fetched) fetched.name = 'Changed';

    expect(getMember(added.id, storage)?.name).toBe('Original');
  });
});

describe('listMembers', () => {
  it('returns all members sorted by name', async () => {
    const { storage } = await createStorage();
    for (const name of ['charlie', 'Alice', 'Bob']) await addMember(input({ name }), storage);

    expect(listMembers(storage).map((member) => member.name)).toEqual(['Alice', 'Bob', 'charlie']);
  });

  it('returns empty array when no members exist', async () => {
    const { storage } = await createStorage();

    expect(listMembers(storage)).toEqual([]);
  });

  it('returns an empty array when the stored value is not a list', async () => {
    const { manager, storage } = await createStorage();
    manager.setData('members', 'oops');

    expect(listMembers(storage)).toEqual([]);
  });
});

describe('updateMember', () => {
  it('merges partial fields and updates updatedAt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    const { storage } = await createStorage();
    const added = await addMember(input({ name: 'Dana', role: 'Designer', level: 'L3' }), storage);

    vi.setSystemTime(new Date('2025-02-01T00:00:00.000Z'));
    const updated = await updateMember(
      added.id,
      { role: 'Senior Designer', status: 'on_leave' },
      storage,
    );

    expect(updated).toMatchObject({
      id: added.id,
      name: 'Dana',
      level: 'L3',
      role: 'Senior Designer',
      status: 'on_leave',
      createdAt: added.createdAt,
      updatedAt: '2025-02-01T00:00:00.000Z',
    });
    expect(getMember(added.id, storage)).toEqual(updated);
  });

  it('records changed fields in the history and leaves it absent when nothing changes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    const { storage } = await createStorage();
    const added = await addMember(input({ status: 'active', role: 'Designer' }), storage);
    expect(added.history).toBeUndefined();

    vi.setSystemTime(new Date('2025-02-01T00:00:00.000Z'));
    const unchanged = await updateMember(added.id, { role: 'Designer' }, storage);
    expect(unchanged.history).toBeUndefined();

    const updated = await updateMember(
      added.id,
      { role: 'Lead Designer', status: 'departing' },
      storage,
    );

    expect(updated.history).toEqual([
      expect.objectContaining({
        field: 'status',
        from: 'active',
        to: 'departing',
        date: '2025-02-01T00:00:00.000Z',
      }),
      expect.objectContaining({ field: 'role', to: 'Lead Designer' }),
    ]);
  });

  it('ignores a history supplied by the caller and keeps the stored one', async () => {
    const { storage } = await createStorage();
    const added = await addMember(input({ role: 'A' }), storage);
    await updateMember(added.id, { role: 'B' }, storage);

    const updated = await updateMember(
      added.id,
      { name: 'Renamed', history: [] } as never,
      storage,
    );

    expect(updated.history?.map((change) => change.field)).toEqual(['role', 'name']);
  });

  it('keeps only the most recent 100 history entries', async () => {
    const { storage } = await createStorage();
    const added = await addMember(input({ role: 'r0' }), storage);

    for (let index = 1; index <= 102; index += 1) {
      await updateMember(added.id, { role: `r${index}` }, storage);
    }

    const history = getMember(added.id, storage)?.history ?? [];
    expect(history).toHaveLength(100);
    expect(history[99]).toMatchObject({ field: 'role', to: 'r102' });
    expect(history[0]).toMatchObject({ to: 'r3' });
  });

  it('refreshes updatedAt even when nothing changes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    const { storage } = await createStorage();
    const added = await addMember(input(), storage);

    vi.setSystemTime(new Date('2025-01-02T00:00:00.000Z'));
    const updated = await updateMember(added.id, {}, storage);

    expect(updated.updatedAt).toBe('2025-01-02T00:00:00.000Z');
  });

  it('throws for nonexistent id without naming anyone', async () => {
    const { storage } = await createStorage();
    await addMember(input({ name: 'Secret Person' }), storage);
    const missing = crypto.randomUUID();

    const failure = await updateMember(missing, { role: 'X' }, storage).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(NotFoundError);
    expect((failure as Error).message).toBe(`Member not found: ${missing}`);
    expect((failure as Error).message).not.toContain('Secret');
  });

  it("does not modify other members' data", async () => {
    const { storage } = await createStorage();
    const target = await addMember(input({ name: 'Target' }), storage);
    const other = await addMember(input({ name: 'Other' }), storage);

    await updateMember(target.id, { name: 'Renamed' }, storage);

    expect(getMember(other.id, storage)).toEqual(other);
  });

  it('cannot change id or createdAt', async () => {
    const { storage } = await createStorage();
    const added = await addMember(input(), storage);

    const updated = await updateMember(
      added.id,
      { id: 'other', createdAt: '2000-01-01T00:00:00.000Z' } as never,
      storage,
    );

    expect(updated.id).toBe(added.id);
    expect(updated.createdAt).toBe(added.createdAt);
  });

  it('validates the merged result and leaves the member untouched on failure', async () => {
    const { storage } = await createStorage();
    const added = await addMember(input({ name: 'Keep' }), storage);

    await expect(updateMember(added.id, { name: '  ' }, storage)).rejects.toThrow(
      'Name is required',
    );
    await expect(updateMember(added.id, { status: 'bogus' as never }, storage)).rejects.toThrow(
      'Status is not valid',
    );
    expect(getMember(added.id, storage)).toEqual(added);
  });

  it('removes the avatar when avatarUrl is set to undefined', async () => {
    const { storage } = await createStorage();
    const added = await addMember(input({ avatarUrl: 'https://example.com/a.png' }), storage);

    const updated = await updateMember(added.id, { avatarUrl: undefined }, storage);

    expect(updated).not.toHaveProperty('avatarUrl');
  });

  it('rejects a member managing themselves or a manager loop', async () => {
    const { storage } = await createStorage();
    const boss = await addMember(input({ name: 'Boss' }), storage);
    const report = await addMember(input({ name: 'Report', manager: boss.id }), storage);

    await expect(updateMember(boss.id, { manager: boss.id }, storage)).rejects.toThrow(
      'cannot report to themselves',
    );
    await expect(updateMember(boss.id, { manager: report.id }, storage)).rejects.toThrow(
      'cannot report to themselves',
    );
  });
});

describe('schedule', () => {
  const schedule = {
    cadence: 'biweekly',
    dayOfWeek: 'tuesday',
    time: '10:00',
    nextDate: '2026-11-10',
  } as const;

  it('stores the schedule inside the member record and keeps it across other edits', async () => {
    const { storage } = await createStorage();
    const added = await addMember(input(), storage);

    const withSchedule = await updateMember(added.id, { schedule }, storage);
    const renamed = await updateMember(added.id, { name: 'Renamed' }, storage);

    expect(withSchedule.schedule).toEqual(schedule);
    expect(getMember(added.id, storage)?.schedule).toEqual(schedule);
    expect(renamed.schedule).toEqual(schedule);
  });

  it('keeps schedule changes out of the edit history', async () => {
    const { storage } = await createStorage();
    const added = await addMember(input(), storage);

    const updated = await updateMember(added.id, { schedule }, storage);

    expect(updated.history).toBeUndefined();
  });

  it('copies only known schedule fields and drops the interval unless custom', async () => {
    const { storage } = await createStorage();
    const added = await addMember(input(), storage);

    const updated = await updateMember(
      added.id,
      { schedule: { ...schedule, customIntervalDays: 5, extra: 'x' } as never },
      storage,
    );

    expect(updated.schedule).toEqual(schedule);
  });

  it('rejects invalid schedules without repeating their values', async () => {
    const { storage } = await createStorage();
    const added = await addMember(input(), storage);
    const attempt = (change: object) =>
      updateMember(added.id, { schedule: { ...schedule, ...change } as never }, storage);

    await expect(attempt({ cadence: 'daily' })).rejects.toThrow('Schedule cadence is not valid');
    await expect(attempt({ dayOfWeek: 'saturday' })).rejects.toThrow('Schedule day is not valid');
    await expect(attempt({ time: '25:00' })).rejects.toThrow('Schedule time is not valid');
    await expect(attempt({ nextDate: '2026-02-30' })).rejects.toThrow('next date is not valid');
    await expect(attempt({ overrideDate: 'soon' })).rejects.toThrow('override date is not valid');
    await expect(attempt({ cadence: 'custom', customIntervalDays: 0 })).rejects.toThrow(
      'whole number of days',
    );
    await expect(attempt({ cadence: 'custom', customIntervalDays: 366 })).rejects.toThrow(
      'whole number of days',
    );
    await expect(attempt({ cadence: 'custom', customIntervalDays: 1.5 })).rejects.toThrow(
      'whole number of days',
    );
    await expect(updateMember(added.id, { schedule: [] as never }, storage)).rejects.toThrow(
      'Schedule must be an object',
    );
    expect(getMember(added.id, storage)?.schedule).toBeUndefined();
  });

  it('removes the schedule when it is set to undefined', async () => {
    const { storage } = await createStorage();
    const added = await addMember(input({ schedule }), storage);

    const updated = await updateMember(added.id, { schedule: undefined }, storage);

    expect(updated).not.toHaveProperty('schedule');
  });
});

describe('deleteMember', () => {
  it('removes member by id', async () => {
    const { storage } = await createStorage();
    const doomed = await addMember(input({ name: 'Doomed' }), storage);
    const kept = await addMember(input({ name: 'Kept' }), storage);

    await deleteMember(doomed.id, storage);

    expect(getMember(doomed.id, storage)).toBeNull();
    expect(listMembers(storage)).toEqual([kept]);
  });

  it('throws for nonexistent id', async () => {
    const { storage } = await createStorage();

    await expect(deleteMember(crypto.randomUUID(), storage)).rejects.toThrow(NotFoundError);
  });

  it('clears the manager reference of the deleted member’s reports', async () => {
    const { storage } = await createStorage();
    const boss = await addMember(input({ name: 'Boss' }), storage);
    const report = await addMember(input({ name: 'Report', manager: boss.id }), storage);

    await deleteMember(boss.id, storage);

    expect(getMember(report.id, storage)?.manager).toBeNull();
  });
});

describe('persistence', () => {
  it('CRUD operations persist through encrypted storage round-trip', async () => {
    const { manager, storage } = await createStorage();
    const kept = await addMember(input({ name: 'Kept', customFields: { team: 'Core' } }), storage);
    const edited = await addMember(input({ name: 'Edited' }), storage);
    const removed = await addMember(input({ name: 'Removed' }), storage);
    const updated = await updateMember(edited.id, { role: 'Staff Engineer' }, storage);
    await deleteMember(removed.id, storage);
    await manager.lock();

    const reopened = new StorageManager();
    await reopened.unlock(PASSPHRASE);

    expect(listMembers(asStorage(reopened))).toEqual([updated, kept]);
    expect(window.localStorage.getItem(STORAGE_DATA_KEY)).not.toContain('Kept');
  });

  it('writes members only under the members property of the encrypted blob', async () => {
    const { storage } = await createStorage();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    await addMember(input(), storage);

    expect(setItem.mock.calls.map(([key]) => key)).toEqual([STORAGE_DATA_KEY]);
  });

  it('failed storage write rolls back optimistic update', async () => {
    const { manager, storage } = await createStorage();
    const kept = await addMember(input({ name: 'Kept' }), storage);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      name: string,
      value: string,
    ) {
      if (name === STORAGE_DATA_KEY) throw new DOMException('full', 'QuotaExceededError');
      original.call(this, name, value);
    });

    const added = addMember(input({ name: 'New' }), storage);
    await expect(added).rejects.toBeInstanceOf(StorageWriteError);
    await expect(updateMember(kept.id, { name: 'Changed' }, storage)).rejects.toMatchObject({
      isQuotaExceeded: true,
    });
    await expect(deleteMember(kept.id, storage)).rejects.toBeInstanceOf(StorageWriteError);

    expect(listMembers(storage)).toEqual([kept]);
    vi.restoreAllMocks();
    await manager.flush();
    await manager.lock();
    const reopened = new StorageManager();
    await reopened.unlock(PASSPHRASE);
    expect(listMembers(asStorage(reopened))).toEqual([kept]);
  });

  it('runs overlapping operations in order so a failed one does not undo a later success', async () => {
    const { storage } = await createStorage();

    const results = await Promise.all([
      addMember(input({ name: 'One' }), storage),
      addMember(input({ name: 'Two' }), storage),
      addMember(input({ name: '' }), storage).catch(() => null),
      addMember(input({ name: 'Three' }), storage),
    ]);

    expect(results[2]).toBeNull();
    expect(listMembers(storage).map((member) => member.name)).toEqual(['One', 'Three', 'Two']);
  });

  it('rejects writes while storage is locked and changes nothing', async () => {
    const { manager, storage } = await createStorage();
    await manager.lock();

    await expect(addMember(input(), storage)).rejects.toThrow('locked');
  });
});

describe('isTeamMemberStatus', () => {
  it('accepts the four statuses and nothing else', () => {
    for (const status of ['active', 'on_leave', 'departing', 'new_hire']) {
      expect(isTeamMemberStatus(status)).toBe(true);
    }
    expect(isTeamMemberStatus('Active')).toBe(false);
    expect(isTeamMemberStatus(undefined)).toBe(false);
  });
});
