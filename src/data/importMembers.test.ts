import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMember } from '../test-utils/factories';
import type { ParsedRow } from '../types/CsvImport';
import { importMembers } from './importMembers';
import * as membersModule from './members';
import type { MemberStorage } from './members';
import type { TeamMember } from '../types/TeamMember';

vi.mock('./members', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./members')>();
  return { ...actual, addMember: vi.fn(actual.addMember) };
});

function createStorage(initial: TeamMember[] = []) {
  const store = new Map<string, unknown>([['members', initial]]);
  const storage: MemberStorage = {
    get: <T>(key: string) => (store.has(key) ? (store.get(key) as T) : null),
    set: (key, value) => void store.set(key, value),
    flush: async () => null,
  };
  return { storage, members: () => store.get('members') as TeamMember[] };
}

function row(overrides: Partial<ParsedRow> = {}): ParsedRow {
  return {
    raw: {},
    name: 'Jane Doe',
    role: 'Engineer',
    level: 'L5',
    startDate: '2022-03-14',
    email: 'jane@example.com',
    manager: '',
    status: 'active',
    isValid: true,
    errors: [],
    ...overrides,
  };
}

const addMemberSpy = vi.mocked(membersModule.addMember);

afterEach(() => {
  addMemberSpy.mockReset();
  vi.useRealTimers();
});

describe('importMembers', () => {
  it('saves every row as a member with the given fields', async () => {
    const { storage, members } = createStorage();

    const result = await importMembers(
      [row(), row({ name: 'Sam Lee', status: 'new_hire', email: '' })],
      storage,
    );

    expect(result).toEqual({ imported: 2, failed: 0 });
    expect(members().map((member) => [member.name, member.status, member.startDate])).toEqual([
      ['Jane Doe', 'active', '2022-03-14'],
      ['Sam Lee', 'new_hire', '2022-03-14'],
    ]);
  });

  it('defaults a blank start date to today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2024, 4, 6, 12));
    const { storage, members } = createStorage();

    await importMembers([row({ startDate: '' })], storage);

    expect(members()[0].startDate).toBe('2024-05-06');
  });

  it('links the manager column to an existing member by name, ignoring case', async () => {
    const boss = createMember({ id: 'boss', name: 'Alice Park' });
    const { storage, members } = createStorage([boss]);

    await importMembers([row({ manager: 'alice park' })], storage);

    expect(members().find((member) => member.name === 'Jane Doe')?.manager).toBe('boss');
  });

  it('saves a manager from the same file before the people who report to them', async () => {
    const { storage, members } = createStorage();

    const result = await importMembers(
      [
        row({ name: 'Report One', manager: 'Lead Person', email: '' }),
        row({ name: 'Lead Person', email: '' }),
      ],
      storage,
    );

    const lead = members().find((member) => member.name === 'Lead Person');
    expect(result.imported).toBe(2);
    expect(members().find((member) => member.name === 'Report One')?.manager).toBe(lead?.id);
  });

  it('leaves the manager empty when the name matches nobody', async () => {
    const { storage, members } = createStorage();

    const result = await importMembers([row({ manager: 'Someone Else' })], storage);

    expect(result.imported).toBe(1);
    expect(members()[0].manager).toBeNull();
  });

  it('does not loop forever when two rows name each other as manager', async () => {
    const { storage, members } = createStorage();

    const result = await importMembers(
      [row({ name: 'A', manager: 'B', email: '' }), row({ name: 'B', manager: 'A', email: '' })],
      storage,
    );

    expect(result.imported).toBe(2);
    expect(members().map((member) => member.manager)).toEqual([null, null]);
  });

  it('keeps members that saved when a later row fails', async () => {
    const { storage, members } = createStorage();
    const actual = await vi.importActual<typeof import('./members')>('./members');
    addMemberSpy.mockImplementation((input, target) =>
      input.name === 'Bad Row'
        ? Promise.reject(new Error('write failed'))
        : actual.addMember(input, target),
    );

    const result = await importMembers(
      [
        row({ name: 'First', email: '' }),
        row({ name: 'Bad Row' }),
        row({ name: 'Last', email: '' }),
      ],
      storage,
    );

    expect(result).toEqual({ imported: 2, failed: 1 });
    expect(members().map((member) => member.name)).toEqual(['First', 'Last']);
  });

  it('counts a row whose status is not valid as failed', async () => {
    const { storage, members } = createStorage();

    const result = await importMembers([row({ status: 'vacation' })], storage);

    expect(result).toEqual({ imported: 0, failed: 1 });
    expect(members()).toHaveLength(0);
  });
});
