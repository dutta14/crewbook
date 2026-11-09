import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { Connection, ConnectionInput, RelationshipType } from '../types/connection';
import { NotFoundError, ValidationError } from './errors';
import { getMember, listMembers } from './members';

/** Who works with whom is an opinion about people, so it lives in the private envelope. */
const STORAGE_KEY = 'connections';

/** Needs `get` as well because both people are validated against the team list. */
export type ConnectionsStorage = Pick<
  EncryptedStorageContextValue,
  'get' | 'set' | 'getPrivate' | 'setPrivate' | 'flush'
>;

export const PEER_NAME_MAX_LENGTH = 100;
export const CONNECTION_NOTES_MAX_LENGTH = 500;
export const MAX_CONNECTIONS_PER_PERSON = 50;

export const RELATIONSHIP_TYPES: readonly RelationshipType[] = [
  'collaborator',
  'mentor',
  'mentee',
  'stakeholder',
];

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  collaborator: 'Collaborator',
  mentor: 'Mentor',
  mentee: 'Mentee',
  stakeholder: 'Stakeholder',
};

/** Only what can change after a connection exists; id and source are never taken from the caller. */
export type ConnectionUpdate = Partial<ConnectionInput>;

export function isRelationshipType(value: unknown): value is RelationshipType {
  return typeof value === 'string' && (RELATIONSHIP_TYPES as readonly string[]).includes(value);
}

const isString = (value: unknown): value is string => typeof value === 'string';

function isConnection(value: unknown): value is Connection {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isString(item.id) &&
    isString(item.sourceMemberId) &&
    (item.targetMemberId === null || isString(item.targetMemberId)) &&
    isString(item.targetName) &&
    isRelationshipType(item.relationship) &&
    (item.notes === undefined || isString(item.notes))
  );
}

// A malformed connection is reported once per id; the message never carries anything typed.
const reportedIds = new Set<string>();

function reportMalformed(value: unknown) {
  const id =
    typeof value === 'object' && value !== null && isString((value as { id?: unknown }).id)
      ? (value as { id: string }).id
      : 'unknown';
  if (reportedIds.has(id)) return;
  reportedIds.add(id);
  // eslint-disable-next-line no-console -- structural warning only; it names the connection, never its content
  console.warn(`Failed to parse connection ${id}`);
}

/** Every well-formed stored connection, with no check against the roster. */
function readStored(storage: ConnectionsStorage): Connection[] {
  const stored = storage.getPrivate<unknown>(STORAGE_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter((item): item is Connection => {
    if (isConnection(item)) return true;
    reportMalformed(item);
    return false;
  });
}

/** Drops control characters; line breaks survive only when `keepLineBreaks` is set. */
function stripControl(value: string, keepLineBreaks: boolean): string {
  return Array.from(value)
    .filter((char) => (keepLineBreaks && char === '\n') || char.charCodeAt(0) > 0x1f)
    .join('');
}

const HTML_TAG = /<[^>]*>/;

function cleanPeerName(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Peer name is required');
  const name = stripControl(value, false).trim();
  if (name === '') throw new ValidationError('Peer name is required');
  if (name.length > PEER_NAME_MAX_LENGTH) {
    throw new ValidationError(`Peer name must be ${PEER_NAME_MAX_LENGTH} characters or fewer`);
  }
  if (HTML_TAG.test(name)) throw new ValidationError('Peer name can not contain HTML tags');
  return name;
}

function cleanNotes(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new ValidationError('Notes must be text');
  const notes = stripControl(value, true).trim();
  if (notes.length > CONNECTION_NOTES_MAX_LENGTH) {
    throw new ValidationError(`Notes must be ${CONNECTION_NOTES_MAX_LENGTH} characters or fewer`);
  }
  return notes === '' ? undefined : notes;
}

function cleanRelationship(value: unknown): RelationshipType {
  if (!isRelationshipType(value)) throw new ValidationError('Relationship type is not valid');
  return value;
}

function requireMember(memberId: unknown, storage: ConnectionsStorage): string {
  if (typeof memberId !== 'string' || !getMember(memberId, storage)) {
    throw new ValidationError('This needs a team member');
  }
  return memberId;
}

interface Target {
  targetMemberId: string | null;
  targetName: string;
}

/** A roster peer must exist and is named by the roster; anything else is cleaned free text. */
function cleanTarget(
  sourceMemberId: string,
  targetMemberId: unknown,
  targetName: unknown,
  storage: ConnectionsStorage,
): Target {
  if (targetMemberId === null || targetMemberId === undefined) {
    return { targetMemberId: null, targetName: cleanPeerName(targetName) };
  }
  if (typeof targetMemberId !== 'string') throw new ValidationError('Peer must be a team member');
  if (targetMemberId === sourceMemberId) {
    throw new ValidationError("A person can't be connected to themselves");
  }
  const peer = getMember(targetMemberId, storage);
  if (!peer) throw new ValidationError('Peer must be an existing team member');
  return { targetMemberId, targetName: peer.name };
}

function isBetween(item: Connection, a: string, b: string | null): boolean {
  return b !== null && item.targetMemberId !== null
    ? (item.sourceMemberId === a && item.targetMemberId === b) ||
        (item.sourceMemberId === b && item.targetMemberId === a)
    : false;
}

/** A pair of people is connected once, whichever side added it. */
function rejectDuplicate(existing: Connection[], candidate: Connection) {
  const key = candidate.targetName.toLowerCase();
  const clash = existing.some(
    (item) =>
      item.id !== candidate.id &&
      (candidate.targetMemberId === null
        ? item.sourceMemberId === candidate.sourceMemberId &&
          item.targetMemberId === null &&
          item.targetName.toLowerCase() === key
        : isBetween(item, candidate.sourceMemberId, candidate.targetMemberId)),
  );
  if (clash) throw new ValidationError('You already have a connection with that person');
}

function involves(item: Connection, memberId: string): boolean {
  return item.sourceMemberId === memberId || item.targetMemberId === memberId;
}

function rejectOverLimit(existing: Connection[], candidate: Connection) {
  const people = [candidate.sourceMemberId, candidate.targetMemberId].filter(
    (id): id is string => id !== null,
  );
  const isFull = people.some(
    (id) =>
      existing.filter((item) => item.id !== candidate.id && involves(item, id)).length >=
      MAX_CONNECTIONS_PER_PERSON,
  );
  if (isFull) {
    throw new ValidationError(
      `A person can have at most ${MAX_CONNECTIONS_PER_PERSON} connections`,
    );
  }
}

// Writes run one at a time so a rollback can never overwrite a later, successful write.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => undefined);
  return result;
}

/** Applies the change to memory, forces the encrypted write and restores `previous` on failure. */
async function commit(
  storage: ConnectionsStorage,
  previous: Connection[],
  next: Connection[],
): Promise<void> {
  storage.setPrivate(STORAGE_KEY, next);
  const failure = await storage.flush();
  if (!failure) return;
  try {
    storage.setPrivate(STORAGE_KEY, previous);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
  throw failure;
}

const withNotes = (notes: string | undefined) => (notes === undefined ? {} : { notes });

export function createConnection(
  sourceMemberId: string,
  input: ConnectionInput,
  storage: ConnectionsStorage,
): Promise<Connection> {
  return enqueue(async () => {
    const source = requireMember(sourceMemberId, storage);
    const connection: Connection = {
      id: crypto.randomUUID(),
      sourceMemberId: source,
      ...cleanTarget(source, input.targetMemberId, input.targetName, storage),
      relationship: cleanRelationship(input.relationship),
      ...withNotes(cleanNotes(input.notes)),
    };
    const previous = readStored(storage);
    rejectDuplicate(previous, connection);
    rejectOverLimit(previous, connection);
    await commit(storage, previous, [...previous, connection]);
    return { ...connection };
  });
}

export function updateConnection(
  id: string,
  updates: ConnectionUpdate,
  storage: ConnectionsStorage,
): Promise<Connection> {
  return enqueue(async () => {
    const previous = readStored(storage);
    const existing = previous.find((item) => item.id === id);
    if (!existing) throw new NotFoundError(id);
    const changesPeer = 'targetMemberId' in updates || 'targetName' in updates;
    const target: Target = changesPeer
      ? cleanTarget(
          existing.sourceMemberId,
          'targetMemberId' in updates ? updates.targetMemberId : existing.targetMemberId,
          'targetName' in updates ? updates.targetName : existing.targetName,
          storage,
        )
      : { targetMemberId: existing.targetMemberId, targetName: existing.targetName };
    const notes = 'notes' in updates ? cleanNotes(updates.notes) : existing.notes;
    const updated: Connection = {
      id: existing.id,
      sourceMemberId: existing.sourceMemberId,
      ...target,
      relationship:
        'relationship' in updates ? cleanRelationship(updates.relationship) : existing.relationship,
      ...withNotes(notes),
    };
    rejectDuplicate(previous, updated);
    rejectOverLimit(previous, updated);
    await commit(
      storage,
      previous,
      previous.map((item) => (item.id === id ? updated : item)),
    );
    return { ...updated };
  });
}

export function deleteConnection(id: string, storage: ConnectionsStorage): Promise<void> {
  return enqueue(async () => {
    const previous = readStored(storage);
    if (!previous.some((item) => item.id === id)) throw new NotFoundError(id);
    await commit(
      storage,
      previous,
      previous.filter((item) => item.id !== id),
    );
  });
}

/**
 * Every connection whose people are still on the team. A link to someone who was deleted is
 * skipped on read, so a reverse link can never point at nobody.
 */
export function getAllConnections(storage: ConnectionsStorage): Connection[] {
  const ids = new Set(listMembers(storage).map((member) => member.id));
  return readStored(storage)
    .filter(
      (item) =>
        ids.has(item.sourceMemberId) &&
        (item.targetMemberId === null || ids.has(item.targetMemberId)),
    )
    .map((item) => ({ ...item }));
}

/** Removes every connection a member is on either side of, for when they leave the team. */
export function deleteConnectionsForMember(
  memberId: string,
  storage: ConnectionsStorage,
): Promise<void> {
  return enqueue(async () => {
    const previous = readStored(storage);
    await commit(
      storage,
      previous,
      previous.filter((item) => !involves(item, memberId)),
    );
  });
}
