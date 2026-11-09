import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConnection as buildConnection, createMember } from '../test-utils/factories';
import { StorageWriteError } from '../utils/encryptedStorage';
import {
  CONNECTION_NOTES_MAX_LENGTH,
  MAX_CONNECTIONS_PER_PERSON,
  PEER_NAME_MAX_LENGTH,
  createConnection,
  deleteConnection,
  deleteConnectionsForMember,
  getAllConnections,
  isRelationshipType,
  updateConnection,
  type ConnectionsStorage,
} from './connectionsStore';
import { NotFoundError, ValidationError } from './errors';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });
const SAM = createMember({ id: 'sam', name: 'Sam Okoye' });

function createStorage(
  privateData: Record<string, unknown> = {},
  failure: StorageWriteError | null = null,
) {
  const data = new Map<string, unknown>(Object.entries(privateData));
  const publicData = new Map<string, unknown>([['members', [ALEX, PRIYA, SAM]]]);
  const flush = vi.fn(async () => failure);
  const storage: ConnectionsStorage = {
    get: <T>(key: string) => (publicData.has(key) ? (publicData.get(key) as T) : null),
    set: <T>(key: string, value: T) => void publicData.set(key, value),
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, flush, publicData };
}

const toPriya = (overrides: Partial<Parameters<typeof createConnection>[1]> = {}) => ({
  targetMemberId: PRIYA.id,
  targetName: 'ignored',
  relationship: 'collaborator' as const,
  notes: 'Pairs on the payments rewrite',
  ...overrides,
});

const crossTeam = (name: string) => ({
  targetMemberId: null,
  targetName: name,
  relationship: 'stakeholder' as const,
});

afterEach(() => vi.restoreAllMocks());

describe('createConnection', () => {
  it('stores one connection in the private envelope, named by the roster, and flushes', async () => {
    const { storage, data, flush } = createStorage();

    const connection = await createConnection(ALEX.id, toPriya(), storage);

    expect(connection).toMatchObject({
      sourceMemberId: ALEX.id,
      targetMemberId: PRIYA.id,
      targetName: 'Priya Nair',
      relationship: 'collaborator',
      notes: 'Pairs on the payments rewrite',
    });
    expect(data.get('connections')).toEqual([connection]);
    expect(flush).toHaveBeenCalled();
  });

  it('keeps a cross-team name as cleaned free text with no reverse side', async () => {
    const { storage } = createStorage();

    const connection = await createConnection(ALEX.id, crossTeam('  Jo\u0000 Rivera  '), storage);

    expect(connection).toMatchObject({ targetMemberId: null, targetName: 'Jo Rivera' });
    expect(connection).not.toHaveProperty('notes');
  });

  it.each([
    ['an empty name', crossTeam('   ')],
    ['a name with HTML', crossTeam('<img src=x onerror=alert(1)>')],
    ['a name over the limit', crossTeam('x'.repeat(PEER_NAME_MAX_LENGTH + 1))],
    [
      'notes over the limit',
      { ...crossTeam('Jo'), notes: 'x'.repeat(CONNECTION_NOTES_MAX_LENGTH + 1) },
    ],
    ['an unknown relationship', { ...crossTeam('Jo'), relationship: 'boss' as never }],
    ['a person connected to themselves', toPriya({ targetMemberId: ALEX.id })],
    ['a team member who does not exist', toPriya({ targetMemberId: 'ghost' })],
  ])('rejects %s without writing', async (_label, bad) => {
    const { storage, flush } = createStorage();

    await expect(createConnection(ALEX.id, bad, storage)).rejects.toBeInstanceOf(ValidationError);
    expect(flush).not.toHaveBeenCalled();
  });

  it('rejects a source that is not on the team', async () => {
    const { storage } = createStorage();

    await expect(createConnection('ghost', toPriya(), storage)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('rejects the same pair from either side, and the same cross-team name twice', async () => {
    const { storage } = createStorage();
    await createConnection(ALEX.id, toPriya(), storage);
    await createConnection(ALEX.id, crossTeam('Jo Rivera'), storage);

    await expect(
      createConnection(PRIYA.id, toPriya({ targetMemberId: ALEX.id }), storage),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(createConnection(ALEX.id, crossTeam('jo rivera'), storage)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('caps the connections one person can have', async () => {
    const stored = Array.from({ length: MAX_CONNECTIONS_PER_PERSON }, (_, index) =>
      buildConnection({
        sourceMemberId: ALEX.id,
        targetMemberId: null,
        targetName: `Peer ${index}`,
      }),
    );
    const { storage } = createStorage({ connections: stored });

    await expect(createConnection(ALEX.id, crossTeam('One more'), storage)).rejects.toBeInstanceOf(
      ValidationError,
    );
    // The cap counts both sides: Priya now has fifty links too.
    await expect(
      createConnection(PRIYA.id, crossTeam('Free text for Priya'), storage),
    ).resolves.toBeDefined();
  });

  it('rolls back and rethrows when the encrypted write fails', async () => {
    const failure = new StorageWriteError(true, true);
    const { storage, data } = createStorage({}, failure);

    await expect(createConnection(ALEX.id, toPriya(), storage)).rejects.toBe(failure);
    expect(data.get('connections')).toEqual([]);
  });

  it('runs overlapping writes one after another so none is lost', async () => {
    const { storage, data } = createStorage();

    await Promise.all([
      createConnection(ALEX.id, crossTeam('One'), storage),
      createConnection(ALEX.id, crossTeam('Two'), storage),
      createConnection(PRIYA.id, crossTeam('Three'), storage),
    ]);

    expect(data.get('connections')).toHaveLength(3);
  });
});

describe('updateConnection', () => {
  it('changes the relationship and notes and keeps the source', async () => {
    const { storage } = createStorage();
    const created = await createConnection(ALEX.id, toPriya(), storage);

    const updated = await updateConnection(
      created.id,
      { relationship: 'mentor', notes: ' Weekly pairing ' },
      storage,
    );

    expect(updated).toMatchObject({
      id: created.id,
      sourceMemberId: ALEX.id,
      relationship: 'mentor',
      notes: 'Weekly pairing',
    });
  });

  it('clears notes when they are emptied', async () => {
    const { storage } = createStorage();
    const created = await createConnection(ALEX.id, toPriya(), storage);

    const updated = await updateConnection(created.id, { notes: '   ' }, storage);

    expect(updated).not.toHaveProperty('notes');
  });

  it('can move a connection to another person and names them from the roster', async () => {
    const { storage } = createStorage();
    const created = await createConnection(ALEX.id, toPriya(), storage);

    const updated = await updateConnection(
      created.id,
      { targetMemberId: SAM.id, targetName: 'whatever' },
      storage,
    );

    expect(updated).toMatchObject({ targetMemberId: SAM.id, targetName: 'Sam Okoye' });
  });

  it('refuses an update that would duplicate another connection or point at the owner', async () => {
    const { storage } = createStorage();
    await createConnection(ALEX.id, toPriya(), storage);
    const other = await createConnection(ALEX.id, crossTeam('Jo'), storage);

    await expect(
      updateConnection(other.id, { targetMemberId: PRIYA.id, targetName: 'x' }, storage),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      updateConnection(other.id, { targetMemberId: ALEX.id, targetName: 'x' }, storage),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a missing connection and an invalid relationship', async () => {
    const { storage } = createStorage();
    const created = await createConnection(ALEX.id, toPriya(), storage);

    await expect(updateConnection('nope', { notes: 'x' }, storage)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(
      updateConnection(created.id, { relationship: 'boss' as never }, storage),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rolls back when the write fails', async () => {
    const { storage, data } = createStorage();
    const created = await createConnection(ALEX.id, toPriya(), storage);
    const failure = new StorageWriteError(true, true);
    vi.spyOn(storage, 'flush').mockResolvedValueOnce(failure);

    await expect(updateConnection(created.id, { relationship: 'mentor' }, storage)).rejects.toBe(
      failure,
    );
    expect(data.get('connections')).toEqual([created]);
  });
});

describe('deleteConnection', () => {
  it('removes the single record, which removes both sides', async () => {
    const { storage } = createStorage();
    const created = await createConnection(ALEX.id, toPriya(), storage);

    await deleteConnection(created.id, storage);

    expect(getAllConnections(storage)).toEqual([]);
  });

  it('rejects an unknown id', async () => {
    const { storage } = createStorage();

    await expect(deleteConnection('nope', storage)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('getAllConnections', () => {
  it('skips connections that point at someone who is no longer on the team', () => {
    const live = buildConnection({ sourceMemberId: ALEX.id, targetMemberId: PRIYA.id });
    const orphanTarget = buildConnection({ sourceMemberId: ALEX.id, targetMemberId: 'gone' });
    const orphanSource = buildConnection({ sourceMemberId: 'gone', targetMemberId: ALEX.id });
    const freeText = buildConnection({ sourceMemberId: ALEX.id, targetMemberId: null });
    const { storage } = createStorage({
      connections: [live, orphanTarget, orphanSource, freeText],
    });

    expect(getAllConnections(storage)).toEqual([live, freeText]);
  });

  it('ignores malformed records without exposing what they held', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const good = buildConnection({ sourceMemberId: ALEX.id, targetMemberId: null });
    const { storage } = createStorage({
      connections: [
        good,
        { id: 'bad-1', relationship: 'boss', targetName: 'secret' },
        'text',
        null,
      ],
    });

    expect(getAllConnections(storage)).toEqual([good]);
    expect(warn).toHaveBeenCalledWith('Failed to parse connection bad-1');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret');
  });

  it('is empty when nothing, or something that is not a list, is stored', () => {
    expect(getAllConnections(createStorage().storage)).toEqual([]);
    expect(getAllConnections(createStorage({ connections: 'oops' }).storage)).toEqual([]);
  });
});

describe('deleteConnectionsForMember', () => {
  it('removes connections on either side and keeps unrelated ones', async () => {
    const outgoing = buildConnection({ sourceMemberId: ALEX.id, targetMemberId: PRIYA.id });
    const incoming = buildConnection({ sourceMemberId: SAM.id, targetMemberId: ALEX.id });
    const unrelated = buildConnection({ sourceMemberId: SAM.id, targetMemberId: PRIYA.id });
    const { storage, data } = createStorage({ connections: [outgoing, incoming, unrelated] });

    await deleteConnectionsForMember(ALEX.id, storage);

    expect(data.get('connections')).toEqual([unrelated]);
  });

  it('works even when the member has already been removed from the team', async () => {
    const stray = buildConnection({ sourceMemberId: 'gone', targetMemberId: PRIYA.id });
    const { storage, data } = createStorage({ connections: [stray] });

    await deleteConnectionsForMember('gone', storage);

    expect(data.get('connections')).toEqual([]);
  });
});

describe('isRelationshipType', () => {
  it('accepts the four relationship types only', () => {
    expect(['collaborator', 'mentor', 'mentee', 'stakeholder'].every(isRelationshipType)).toBe(
      true,
    );
    expect(isRelationshipType('friend')).toBe(false);
    expect(isRelationshipType(3)).toBe(false);
  });
});
