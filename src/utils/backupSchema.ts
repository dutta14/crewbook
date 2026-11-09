import {
  ENVELOPE_ENTRIES,
  SETTING_KEYS,
  countRecords,
  keysOf,
  type CountLine,
  type EnvelopeEntry,
} from '../data/envelopeSchema';
import {
  BackupValidationError,
  FieldIssue,
  assertNoReservedKeys,
  isPlainObject,
  isoDate,
} from './schemaCheck';

export const BACKUP_VERSION = 1;

const META_KEYS = ['version', 'exportedAt', 'privateDataIncluded'] as const;
const REQUIRED_KEYS = ['members'] as const;
const NOT_A_BACKUP = 'This file is not a valid Crewbook backup.';

type DataObject = Record<string, unknown>;

/** A validated backup: every collection is present, checked, and split by the envelope it belongs to. */
export interface BackupData {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  privateDataIncluded: boolean;
  main: DataObject;
  private: DataObject;
}

export interface BackupSummary {
  exportedAt: string;
  privateDataIncluded: boolean;
  counts: CountLine[];
}

/** What the app holds right now. `private` is null when the private envelope could not be opened. */
export interface DataSnapshot {
  main: DataObject;
  private: DataObject | null;
}

const emptyValue = (entry: EnvelopeEntry): unknown =>
  entry.key === 'settings' || entry.key === 'noteDrafts' ? {} : [];

function describeIssue(entry: EnvelopeEntry, error: FieldIssue): BackupValidationError {
  const where = `in ${entry.key}`;
  return new BackupValidationError(
    error.field === '' ? `Invalid ${entry.key}` : `Invalid field '${error.field}' ${where}`,
  );
}

function checkEntry(entry: EnvelopeEntry, value: unknown): unknown {
  try {
    return entry.check(value);
  } catch (error) {
    if (error instanceof FieldIssue) throw describeIssue(entry, error);
    throw error;
  }
}

function idsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const id = (item as { id?: unknown }).id;
    return typeof id === 'string' ? [id] : [];
  });
}

function assertUniqueIds(key: string, value: unknown): void {
  if (!Array.isArray(value)) return;
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const id = (item as { id?: unknown }).id;
    if (typeof id !== 'string') return;
    if (seen.has(id)) throw new BackupValidationError(`Duplicate id in ${key} at index ${index}`);
    seen.add(id);
  });
}

interface MemberLink {
  id: string;
  manager: string | null;
}

function assertManagerChain(members: MemberLink[]): void {
  const managerOf = new Map(members.map((member) => [member.id, member.manager]));
  members.forEach((member, index) => {
    if (member.manager === null) return;
    if (!managerOf.has(member.manager) || member.manager === member.id) {
      throw new BackupValidationError(`Invalid field 'manager' in members at index ${index}`);
    }
    let cursor: string | null = member.manager;
    for (let hops = 0; cursor !== null; hops += 1) {
      if (cursor === member.id || hops > members.length) {
        throw new BackupValidationError(`Invalid field 'manager' in members at index ${index}`);
      }
      cursor = managerOf.get(cursor) ?? null;
    }
  });
}

function assertCrossReferences(main: DataObject, priv: DataObject): void {
  for (const entry of ENVELOPE_ENTRIES) {
    const value = (entry.envelope === 'main' ? main : priv)[entry.key];
    assertUniqueIds(entry.key, value);
  }
  const privateNoteIds = new Set(idsOf(priv.notes));
  if (idsOf(main.sharedNotes).some((id) => privateNoteIds.has(id))) {
    throw new BackupValidationError('A note appears as both shared and private');
  }
  assertManagerChain(main.members as MemberLink[]);
}

/**
 * Strictly validates parsed backup contents. Unknown fields, wrong types, oversized values and
 * reserved keys are all refused, and nothing is accepted partially. Missing collections become
 * empty, but `version`, `exportedAt`, `privateDataIncluded` and `members` are required.
 */
export function validateBackupSchema(raw: unknown): BackupData {
  if (!isPlainObject(raw)) throw new BackupValidationError(NOT_A_BACKUP);
  assertNoReservedKeys(raw);

  const allowed = new Set<string>([...META_KEYS, ...ENVELOPE_ENTRIES.map((entry) => entry.key)]);
  if (Object.keys(raw).some((key) => !allowed.has(key))) {
    throw new BackupValidationError('The backup contains an unexpected field');
  }
  for (const key of [...META_KEYS, ...REQUIRED_KEYS]) {
    if (!Object.hasOwn(raw, key)) throw new BackupValidationError(`The backup is missing '${key}'`);
  }

  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new BackupValidationError("Invalid field 'version' in backup");
  }
  if (version > BACKUP_VERSION) {
    throw new BackupValidationError(
      'This backup was made by a newer version of Crewbook. Update Crewbook, then try again.',
    );
  }
  try {
    isoDate(raw.exportedAt);
  } catch {
    throw new BackupValidationError("Invalid field 'exportedAt' in backup");
  }
  if (typeof raw.privateDataIncluded !== 'boolean') {
    throw new BackupValidationError("Invalid field 'privateDataIncluded' in backup");
  }
  const privateDataIncluded = raw.privateDataIncluded;
  if (!privateDataIncluded && keysOf('private').some((key) => Object.hasOwn(raw, key))) {
    throw new BackupValidationError('The backup says it has no private data but it contains some');
  }

  const main: DataObject = {};
  const priv: DataObject = {};
  for (const entry of ENVELOPE_ENTRIES) {
    const target = entry.envelope === 'main' ? main : priv;
    target[entry.key] = Object.hasOwn(raw, entry.key)
      ? checkEntry(entry, raw[entry.key])
      : emptyValue(entry);
  }
  assertCrossReferences(main, priv);

  return {
    version: BACKUP_VERSION,
    exportedAt: raw.exportedAt as string,
    privateDataIncluded,
    main,
    private: priv,
  };
}

/** Parses and validates backup text. Plain JSON.parse only; nothing in the file is evaluated. */
export function parseBackup(text: string): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupValidationError(NOT_A_BACKUP);
  }
  return validateBackupSchema(raw);
}

/** The flat shape written to a file: metadata first, then every collection by its own key. */
export function toBackupJson(data: BackupData): string {
  const flat: DataObject = {
    version: data.version,
    exportedAt: data.exportedAt,
    privateDataIncluded: data.privateDataIncluded,
    ...data.main,
    ...(data.privateDataIncluded ? data.private : {}),
  };
  return JSON.stringify(flat);
}

function pickKeys(source: DataObject, keys: readonly string[]): DataObject {
  const picked: DataObject = {};
  for (const key of keys) {
    if (Object.hasOwn(source, key)) picked[key] = source[key];
  }
  return picked;
}

/**
 * Builds a backup from the live data and runs it through the same validation an import uses, so a
 * file that would be refused on the way back in is never written.
 */
export function createBackup(snapshot: DataSnapshot, now: Date = new Date()): BackupData {
  const main = pickKeys(snapshot.main, keysOf('main'));
  if (isPlainObject(main.settings)) main.settings = pickKeys(main.settings, SETTING_KEYS);
  const flat: DataObject = {
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    privateDataIncluded: snapshot.private !== null,
    ...main,
    ...(snapshot.private ? pickKeys(snapshot.private, keysOf('private')) : {}),
  };
  // A JSON round trip drops anything that is not plain data before it is validated.
  return validateBackupSchema(JSON.parse(JSON.stringify(flat)));
}

const ALWAYS_LISTED: readonly string[] = ['members', 'notes', 'actionItems'];

/** Counts for the import preview. The three headline categories always show, others when present. */
export function summarizeBackup(data: BackupData): BackupSummary {
  const counts = countRecords({ ...data.main, ...data.private }).filter(
    (line) => line.count > 0 || ALWAYS_LISTED.includes(line.id),
  );
  return { exportedAt: data.exportedAt, privateDataIncluded: data.privateDataIncluded, counts };
}

/** Counts of the sensitive records in a snapshot, for the warning shown before an export. */
export function summarizePrivateData(snapshot: DataSnapshot): CountLine[] {
  if (!snapshot.private) return [];
  return countRecords(snapshot.private, true).filter((line) => line.count > 0);
}
