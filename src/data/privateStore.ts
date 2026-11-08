import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { FlightRiskLevel, PrivateNote } from '../types/flightRisk';
import { ValidationError } from './errors';
import { getMember } from './members';

/*
 * Private notes and flight risk levels live in the private envelope and nowhere else.
 *
 * Seam for the sharing and export issues: nothing in this module may be imported by share,
 * export, summary or promo-packet code, and no function here returns notes for more than one
 * person. Shared payloads must be built from an allowlist of fields, never by spreading stored
 * records. Nothing here logs: not content, not levels, not ids.
 */
const STORAGE_KEY = 'flightRisk';

export type PrivateNotesStorage = Pick<
  EncryptedStorageContextValue,
  'get' | 'set' | 'getPrivate' | 'setPrivate' | 'flush'
>;

export const PRIVATE_NOTE_MAX_LENGTH = 2000;

export const FLIGHT_RISK_LEVELS: readonly FlightRiskLevel[] = ['none', 'low', 'medium', 'high'];

export const FLIGHT_RISK_LABELS: Record<FlightRiskLevel, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export function isFlightRiskLevel(value: unknown): value is FlightRiskLevel {
  return typeof value === 'string' && (FLIGHT_RISK_LEVELS as readonly string[]).includes(value);
}

const isString = (value: unknown): value is string => typeof value === 'string';

function isPrivateNote(value: unknown): value is PrivateNote {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isString(item.id) &&
    isString(item.engineerId) &&
    isString(item.text) &&
    isFlightRiskLevel(item.flightRisk) &&
    isString(item.createdAt)
  );
}

function readNotes(storage: PrivateNotesStorage): PrivateNote[] {
  const stored = storage.getPrivate<unknown>(STORAGE_KEY);
  return Array.isArray(stored) ? stored.filter(isPrivateNote) : [];
}

/** Drops control characters but keeps line breaks, then enforces the length limit. */
function cleanText(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Note must be text');
  const text = Array.from(value)
    .filter((char) => char === '\n' || char.charCodeAt(0) > 0x1f)
    .join('')
    .trim();
  if (text === '') throw new ValidationError('Write a note before saving');
  if (text.length > PRIVATE_NOTE_MAX_LENGTH) {
    throw new ValidationError(`Note must be ${PRIVATE_NOTE_MAX_LENGTH} characters or fewer`);
  }
  return text;
}

function requireEngineer(engineerId: unknown, storage: PrivateNotesStorage): string {
  if (typeof engineerId !== 'string' || !getMember(engineerId, storage)) {
    throw new ValidationError('This needs a team member');
  }
  return engineerId;
}

// Writes run one at a time so a rollback can never overwrite a later, successful write.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => undefined);
  return result;
}

/** Fails closed: memory is restored and the error rethrown when the encrypted write does not land. */
async function commit(
  storage: PrivateNotesStorage,
  previous: PrivateNote[],
  next: PrivateNote[],
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

/** Appends a note. There is deliberately no update or single-note delete. */
export function addPrivateNote(
  engineerId: string,
  text: string,
  flightRisk: FlightRiskLevel,
  storage: PrivateNotesStorage,
): Promise<PrivateNote> {
  return enqueue(async () => {
    if (!isFlightRiskLevel(flightRisk)) throw new ValidationError('Flight risk level is not valid');
    const note: PrivateNote = {
      id: crypto.randomUUID(),
      engineerId: requireEngineer(engineerId, storage),
      text: cleanText(text),
      flightRisk,
      createdAt: new Date().toISOString(),
    };
    const previous = readNotes(storage);
    await commit(storage, previous, [...previous, note]);
    return { ...note };
  });
}

/** One person's notes, newest first. Notes with the same timestamp show the later one on top. */
export function getPrivateNotes(storage: PrivateNotesStorage, engineerId: string): PrivateNote[] {
  return readNotes(storage)
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.engineerId === engineerId)
    .sort(
      (a, b) => Date.parse(b.item.createdAt) - Date.parse(a.item.createdAt) || b.index - a.index,
    )
    .map(({ item }) => ({ ...item }));
}

/** The level on a person's latest note; 'none' when there are no notes. */
export function getFlightRiskLevel(
  storage: PrivateNotesStorage,
  engineerId: string,
): FlightRiskLevel {
  return getPrivateNotes(storage, engineerId)[0]?.flightRisk ?? 'none';
}

/** Hard-deletes every note for a member, for when they leave the team. */
export function deletePrivateNotesForMember(
  memberId: string,
  storage: PrivateNotesStorage,
): Promise<void> {
  return enqueue(async () => {
    const previous = readNotes(storage);
    await commit(
      storage,
      previous,
      previous.filter((item) => item.engineerId !== memberId),
    );
  });
}
