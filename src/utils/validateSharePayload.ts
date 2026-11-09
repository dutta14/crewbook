import type {
  SharedActionItem,
  SharedAgendaItem,
  SharedNote,
  SharedViewPayload,
  SharePerson,
} from '../types/sharing';
import { parseIsoDate } from './scheduleCalculator';
import { ttlForLifetime } from './shareExpiry';

export const SHARE_LIMITS = {
  nameLength: 100,
  noteLength: 10_000,
  titleLength: 200,
  agendaLength: 500,
  maxNotes: 100,
  maxActionItems: 200,
  maxAgendaItems: 100,
  maxInitials: 4,
  /** Largest payload JSON, in bytes, that a link will carry. */
  maxPayloadBytes: 64 * 1024,
} as const;

const PAYLOAD_KEYS = [
  'v',
  'id',
  'managerName',
  'engineerName',
  'engineerAvatar',
  'sharedNotes',
  'actionItems',
  'agendaItems',
  'createdAt',
  'expiresAt',
] as const;
const NOTE_KEYS = ['id', 'text', 'createdAt'] as const;
const ACTION_KEYS = ['id', 'title', 'status', 'dueDate', 'owner'] as const;
const AGENDA_KEYS = ['id', 'text', 'addedBy', 'createdAt'] as const;
const AVATAR_KEYS = ['initials', 'color'] as const;

const COLOR = /^#[0-9a-f]{6}$/i;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Raw, keys: readonly string[]) =>
  Object.keys(value).every((key) => keys.includes(key));

const isText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max;

const isId = (value: unknown): value is string => typeof value === 'string' && ID.test(value);

const isMoment = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 40 && !Number.isNaN(new Date(value).getTime());

const isPerson = (value: unknown): value is SharePerson =>
  value === 'manager' || value === 'engineer';

function readNote(value: unknown): SharedNote | null {
  if (!isRecord(value) || !hasOnlyKeys(value, NOTE_KEYS)) return null;
  const { id, text, createdAt } = value;
  if (!isId(id) || !isText(text, SHARE_LIMITS.noteLength) || !isMoment(createdAt)) return null;
  return { id, text, createdAt };
}

function readAction(value: unknown): SharedActionItem | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ACTION_KEYS)) return null;
  const { id, title, status, dueDate, owner } = value;
  if (!isId(id) || !isText(title, SHARE_LIMITS.titleLength) || !isPerson(owner)) return null;
  if (status !== 'open' && status !== 'done') return null;
  if (dueDate === undefined) return { id, title, status, owner };
  if (typeof dueDate !== 'string' || parseIsoDate(dueDate) === null) return null;
  return { id, title, status, dueDate, owner };
}

function readAgenda(value: unknown): SharedAgendaItem | null {
  if (!isRecord(value) || !hasOnlyKeys(value, AGENDA_KEYS)) return null;
  const { id, text, addedBy, createdAt } = value;
  if (!isId(id) || !isText(text, SHARE_LIMITS.agendaLength) || !isPerson(addedBy)) return null;
  if (!isMoment(createdAt)) return null;
  return { id, text, addedBy, createdAt };
}

function readList<T>(value: unknown, max: number, read: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const items: T[] = [];
  for (const entry of value) {
    const item = read(entry);
    if (item === null) return null;
    items.push(item);
  }
  return items;
}

/**
 * Checks untrusted data against the payload shape and returns a clean copy, or null. Unknown keys
 * anywhere are a rejection, so nothing outside the allowlist survives a round trip.
 */
export function validateSharePayload(value: unknown): SharedViewPayload | null {
  if (!isRecord(value) || !hasOnlyKeys(value, PAYLOAD_KEYS) || value.v !== 1) return null;
  const { id, managerName, engineerName, engineerAvatar, createdAt, expiresAt } = value;
  if (!isId(id) || !isMoment(createdAt) || !isMoment(expiresAt)) return null;
  // Only the preset lifetimes exist, so any other gap between the two moments was not made here.
  if (ttlForLifetime(Date.parse(expiresAt) - Date.parse(createdAt)) === null) return null;
  if (!isText(managerName, SHARE_LIMITS.nameLength) || managerName.trim() === '') return null;
  if (!isText(engineerName, SHARE_LIMITS.nameLength) || engineerName.trim() === '') return null;
  if (!isRecord(engineerAvatar) || !hasOnlyKeys(engineerAvatar, AVATAR_KEYS)) return null;
  const { initials, color } = engineerAvatar;
  if (!isText(initials, SHARE_LIMITS.maxInitials)) return null;
  if (typeof color !== 'string' || !COLOR.test(color)) return null;

  const sharedNotes = readList(value.sharedNotes, SHARE_LIMITS.maxNotes, readNote);
  const actionItems = readList(value.actionItems, SHARE_LIMITS.maxActionItems, readAction);
  const agendaItems = readList(value.agendaItems, SHARE_LIMITS.maxAgendaItems, readAgenda);
  if (!sharedNotes || !actionItems || !agendaItems) return null;

  return {
    v: 1,
    id,
    managerName,
    engineerName,
    engineerAvatar: { initials, color },
    sharedNotes,
    actionItems,
    agendaItems,
    createdAt,
    expiresAt,
  };
}
