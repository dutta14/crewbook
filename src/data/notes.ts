import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { LiveSession } from '../types/LiveSession';
import type { Note, NoteVisibility } from '../types/Note';
import { archiveAgendaForMember } from './agenda';
import { NotFoundError, ValidationError } from './errors';
import { getDefaultNoteVisibility, isNoteVisibility } from './settings';

/*
 * Where a note lives depends on its visibility. Private notes and drafts are in the private
 * envelope, which the caller must have loaded already. Shared notes are in the main envelope.
 * Nothing but this module decides which side a note is on, and the side wins over any `visibility`
 * value found inside a stored record: a note in the private envelope is private.
 */
const NOTES_KEY = 'notes';
const SHARED_NOTES_KEY = 'sharedNotes';
const DRAFTS_KEY = 'noteDrafts';

export type NoteStorage = Pick<
  EncryptedStorageContextValue,
  'get' | 'set' | 'getPrivate' | 'setPrivate' | 'flush'
>;

export const NOTE_MAX_LENGTH = 10_000;
export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export class NoteLockedError extends Error {
  constructor() {
    super('This note is locked and can no longer be edited');
    this.name = 'NoteLockedError';
  }
}

type Drafts = Record<string, string>;

type StoredNote = Omit<Note, 'visibility'>;

function isStoredNote(value: unknown): value is StoredNote {
  if (typeof value !== 'object' || value === null) return false;
  const note = value as Record<string, unknown>;
  return (
    typeof note.id === 'string' &&
    typeof note.memberId === 'string' &&
    typeof note.content === 'string' &&
    typeof note.createdAt === 'string' &&
    typeof note.updatedAt === 'string'
  );
}

/** Copies field by field, so a stray stored field can never ride along. */
function withVisibility(note: StoredNote, visibility: NoteVisibility): Note {
  return {
    id: note.id,
    memberId: note.memberId,
    content: note.content,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    visibility,
  };
}

function readStored(stored: unknown, visibility: NoteVisibility): Note[] {
  return Array.isArray(stored)
    ? stored.filter(isStoredNote).map((note) => withVisibility(note, visibility))
    : [];
}

interface Library {
  /** Stored in the private envelope. */
  hidden: Note[];
  /** Stored in the main envelope. */
  shared: Note[];
  drafts: Drafts;
}

/**
 * Both sides of the store. A note found on both sides (a crash between the two writes of a move)
 * counts as private, the safer state, and the shared copy is dropped by the next write.
 */
function readLibrary(storage: NoteStorage): Library {
  const hidden = readStored(storage.getPrivate<unknown>(NOTES_KEY), 'private');
  const hiddenIds = new Set(hidden.map((note) => note.id));
  const shared = readStored(storage.get<unknown>(SHARED_NOTES_KEY), 'shared').filter(
    (note) => !hiddenIds.has(note.id),
  );
  return { hidden, shared, drafts: readDrafts(storage) };
}

function requireVisibility(value: unknown): NoteVisibility {
  if (!isNoteVisibility(value)) throw new ValidationError('Choose shared or private');
  return value;
}

function readDrafts(storage: NoteStorage): Drafts {
  const stored = storage.getPrivate<unknown>(DRAFTS_KEY);
  return typeof stored === 'object' && stored !== null && !Array.isArray(stored)
    ? (stored as Drafts)
    : {};
}

/** Throws a ValidationError that never repeats the note text. */
function cleanContent(content: unknown): string {
  if (typeof content !== 'string') throw new ValidationError('Note must be text');
  if (content.trim().length === 0) throw new ValidationError('Note must not be empty');
  if (content.length > NOTE_MAX_LENGTH) {
    throw new ValidationError(`Note must be ${NOTE_MAX_LENGTH} characters or fewer`);
  }
  return content;
}

// Writes run one at a time so a rollback can never overwrite a later, successful write.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => undefined);
  return result;
}

function restore(storage: NoteStorage, library: Library): void {
  try {
    storage.setPrivate(NOTES_KEY, library.hidden);
    storage.set(SHARED_NOTES_KEY, library.shared);
    storage.setPrivate(DRAFTS_KEY, library.drafts);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
}

/** Applies the change to memory, forces the encrypted write and restores `previous` on failure. */
async function commit(storage: NoteStorage, previous: Library, next: Library): Promise<void> {
  storage.setPrivate(NOTES_KEY, next.hidden);
  // The main envelope is only rewritten when the shared notes changed.
  if (next.shared !== previous.shared) storage.set(SHARED_NOTES_KEY, next.shared);
  storage.setPrivate(DRAFTS_KEY, next.drafts);
  const failure = await storage.flush();
  if (!failure) return;
  restore(storage, previous);
  throw failure;
}

/**
 * Moves notes between the envelopes: the copy in the destination is written first and the
 * original removed second, so a crash between the two leaves a duplicate (read as private) and
 * never a lost note. Either every note moves or none does.
 */
async function commitMove(
  storage: NoteStorage,
  previous: Library,
  next: Library,
  destination: NoteVisibility,
): Promise<void> {
  const copied: Library =
    destination === 'shared'
      ? { ...previous, shared: next.shared }
      : { ...previous, hidden: next.hidden };
  await commit(storage, previous, copied);
  try {
    await commit(storage, copied, next);
  } catch (failure) {
    restore(storage, previous);
    await storage.flush();
    throw failure;
  }
}

function withoutDraft(drafts: Drafts, memberId: string): Drafts {
  const rest = { ...drafts };
  delete rest[memberId];
  return rest;
}

/** Whether a note may still be edited. Compares the stored timestamp with the local clock. */
export function isNoteEditable(note: Pick<Note, 'createdAt'>, now: number = Date.now()): boolean {
  const created = Date.parse(note.createdAt);
  return !Number.isNaN(created) && now - created < EDIT_WINDOW_MS;
}

/**
 * Saves a new note and discards that member's draft in the same write. A new note is a new 1:1,
 * so the topics on that member's agenda are archived once it is saved. It is private unless the
 * caller says otherwise or the manager's default setting is shared.
 */
export function addNote(
  memberId: string,
  content: string,
  storage: NoteStorage,
  visibility?: NoteVisibility,
): Promise<Note> {
  return enqueue(async () => {
    if (typeof memberId !== 'string' || memberId.length === 0) {
      throw new ValidationError('Note needs a team member');
    }
    const clean = cleanContent(content);
    const target =
      visibility === undefined ? getDefaultNoteVisibility(storage) : requireVisibility(visibility);
    const library = readLibrary(storage);
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      memberId,
      content: clean,
      createdAt: now,
      updatedAt: now,
      visibility: target,
    };
    const drafts = withoutDraft(library.drafts, memberId);
    await commit(
      storage,
      library,
      target === 'shared'
        ? { ...library, shared: [...library.shared, note], drafts }
        : { ...library, hidden: [...library.hidden, note], drafts },
    );
    // The note is saved, so a failure here must not fail it; the topics stay on the agenda.
    await archiveAgendaForMember(memberId, storage, new Date(now)).catch(() => undefined);
    return { ...note };
  });
}

export const EMPTY_SESSION_NOTE = '(No notes)';

/**
 * Turns a finished live session into one ordinary note stamped with the moment it ended, and
 * discards the member's auto-saved draft in the same write. A session with nothing written still
 * leaves a record that the 1:1 happened.
 */
export function saveLiveSession(session: LiveSession, storage: NoteStorage): Promise<Note> {
  const content = session.content.trim();
  return addNote(session.memberId, content.length > 0 ? content : EMPTY_SESSION_NOTE, storage);
}

/** Throws NoteLockedError once the note is more than 24 hours old. Visibility never changes here. */
export function updateNote(noteId: string, content: string, storage: NoteStorage): Promise<Note> {
  return enqueue(async () => {
    const clean = cleanContent(content);
    const library = readLibrary(storage);
    const existing = [...library.hidden, ...library.shared].find((note) => note.id === noteId);
    if (!existing) throw new NotFoundError(noteId);
    if (!isNoteEditable(existing)) throw new NoteLockedError();
    const updated: Note = { ...existing, content: clean, updatedAt: new Date().toISOString() };
    const replace = (notes: Note[]) => notes.map((note) => (note.id === noteId ? updated : note));
    await commit(
      storage,
      library,
      existing.visibility === 'shared'
        ? { ...library, shared: replace(library.shared) }
        : { ...library, hidden: replace(library.hidden) },
    );
    return { ...updated };
  });
}

/**
 * Changes who may see a note. Allowed at any age, including after the 24 hour edit lock: the lock
 * protects what the note says, while the manager must always be able to pull a note back. The
 * text and its timestamps do not change.
 */
export function setNoteVisibility(
  noteId: string,
  visibility: NoteVisibility,
  storage: NoteStorage,
): Promise<Note> {
  return enqueue(async () => {
    const target = requireVisibility(visibility);
    const library = readLibrary(storage);
    const existing = [...library.hidden, ...library.shared].find((note) => note.id === noteId);
    if (!existing) throw new NotFoundError(noteId);
    if (existing.visibility === target) return { ...existing };
    await commitMove(storage, library, moveNotes(library, new Set([noteId]), target), target);
    return { ...existing, visibility: target };
  });
}

/** The library with these notes on the destination's side. */
function moveNotes(library: Library, ids: ReadonlySet<string>, target: NoteVisibility): Library {
  const moving = (notes: Note[]) => notes.filter((note) => ids.has(note.id));
  const staying = (notes: Note[]) => notes.filter((note) => !ids.has(note.id));
  return target === 'shared'
    ? {
        ...library,
        hidden: staying(library.hidden),
        shared: [
          ...library.shared,
          ...moving(library.hidden).map((n) => ({ ...n, visibility: target })),
        ],
      }
    : {
        ...library,
        hidden: [
          ...library.hidden,
          ...moving(library.shared).map((n) => ({ ...n, visibility: target })),
        ],
        shared: staying(library.shared),
      };
}

/**
 * Makes every note of one person shared or private in a single all-or-nothing change. Returns how
 * many notes changed side; notes already on that side are left alone.
 */
export function setVisibilityForMember(
  memberId: string,
  visibility: NoteVisibility,
  storage: NoteStorage,
): Promise<number> {
  return enqueue(async () => {
    const target = requireVisibility(visibility);
    const library = readLibrary(storage);
    const source = target === 'shared' ? library.hidden : library.shared;
    const ids = new Set(source.filter((note) => note.memberId === memberId).map((note) => note.id));
    if (ids.size === 0) return 0;
    await commitMove(storage, library, moveNotes(library, ids, target), target);
    return ids.size;
  });
}

const newestFirst = (notes: Note[]): Note[] =>
  notes
    .map((note, index) => ({ note, index }))
    .sort(
      (a, b) => Date.parse(b.note.createdAt) - Date.parse(a.note.createdAt) || b.index - a.index,
    )
    .map(({ note }) => ({ ...note }));

/** A member's notes, shared and private, newest first. */
export function listNotes(memberId: string, storage: NoteStorage): Note[] {
  const { hidden, shared } = readLibrary(storage);
  return newestFirst([...hidden, ...shared].filter((note) => note.memberId === memberId));
}

/**
 * Only a member's shared notes. This is what share code reads, so private notes are never handed
 * to it in the first place; serializeForSharing then checks each note again.
 */
export function listSharedNotes(memberId: string, storage: NoteStorage): Note[] {
  return newestFirst(readLibrary(storage).shared.filter((note) => note.memberId === memberId));
}

/** Case-insensitive substring match on the raw markdown. Never uses a regular expression. */
export function searchNotes(memberId: string, query: string, storage: NoteStorage): Note[] {
  const notes = listNotes(memberId, storage);
  const needle = query.trim().toLowerCase();
  return needle ? notes.filter((note) => note.content.toLowerCase().includes(needle)) : notes;
}

/** The ids of every note, for checking that a link to one still has somewhere to go. */
export function listNoteIds(storage: NoteStorage): Set<string> {
  const { hidden, shared } = readLibrary(storage);
  return new Set([...hidden, ...shared].map((note) => note.id));
}

export function getDraft(memberId: string, storage: NoteStorage): string {
  const draft = readDrafts(storage)[memberId];
  return typeof draft === 'string' ? draft : '';
}

/** Persists an unsent note to the encrypted store. An empty draft removes the entry. */
export function saveDraft(memberId: string, content: string, storage: NoteStorage): Promise<void> {
  return enqueue(async () => {
    if (content.length > NOTE_MAX_LENGTH) {
      throw new ValidationError(`Note must be ${NOTE_MAX_LENGTH} characters or fewer`);
    }
    const library = readLibrary(storage);
    const next =
      content.trim().length === 0
        ? withoutDraft(library.drafts, memberId)
        : { ...library.drafts, [memberId]: content };
    await commit(storage, library, { ...library, drafts: next });
  });
}

/** Removes every note and draft for a member, for when they leave the team. */
export function deleteNotesForMember(memberId: string, storage: NoteStorage): Promise<void> {
  return enqueue(async () => {
    const library = readLibrary(storage);
    const others = (notes: Note[]) => notes.filter((note) => note.memberId !== memberId);
    await commit(storage, library, {
      hidden: others(library.hidden),
      shared: others(library.shared),
      drafts: withoutDraft(library.drafts, memberId),
    });
  });
}
