import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { LiveSession } from '../types/LiveSession';
import type { Note } from '../types/Note';
import { NotFoundError, ValidationError } from './errors';

/** Notes and drafts live in the private envelope, which the caller must have loaded already. */
const NOTES_KEY = 'notes';
const DRAFTS_KEY = 'noteDrafts';

export type NoteStorage = Pick<EncryptedStorageContextValue, 'getPrivate' | 'setPrivate' | 'flush'>;

export const NOTE_MAX_LENGTH = 10_000;
export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export class NoteLockedError extends Error {
  constructor() {
    super('This note is locked and can no longer be edited');
    this.name = 'NoteLockedError';
  }
}

type Drafts = Record<string, string>;

function isNote(value: unknown): value is Note {
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

function readNotes(storage: NoteStorage): Note[] {
  const stored = storage.getPrivate<unknown>(NOTES_KEY);
  return Array.isArray(stored) ? stored.filter(isNote) : [];
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

/** Applies the change to memory, forces the encrypted write and restores `previous` on failure. */
async function commit(
  storage: NoteStorage,
  previous: { notes: Note[]; drafts: Drafts },
  next: { notes: Note[]; drafts: Drafts },
): Promise<void> {
  storage.setPrivate(NOTES_KEY, next.notes);
  storage.setPrivate(DRAFTS_KEY, next.drafts);
  const failure = await storage.flush();
  if (!failure) return;
  try {
    storage.setPrivate(NOTES_KEY, previous.notes);
    storage.setPrivate(DRAFTS_KEY, previous.drafts);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
  throw failure;
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

/** Saves a new note and discards that member's draft in the same write. */
export function addNote(memberId: string, content: string, storage: NoteStorage): Promise<Note> {
  return enqueue(async () => {
    if (typeof memberId !== 'string' || memberId.length === 0) {
      throw new ValidationError('Note needs a team member');
    }
    const clean = cleanContent(content);
    const notes = readNotes(storage);
    const drafts = readDrafts(storage);
    const now = new Date().toISOString();
    const note: Note = {
      id: crypto.randomUUID(),
      memberId,
      content: clean,
      createdAt: now,
      updatedAt: now,
    };
    await commit(
      storage,
      { notes, drafts },
      { notes: [...notes, note], drafts: withoutDraft(drafts, memberId) },
    );
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

/** Throws NoteLockedError once the note is more than 24 hours old. */
export function updateNote(noteId: string, content: string, storage: NoteStorage): Promise<Note> {
  return enqueue(async () => {
    const clean = cleanContent(content);
    const notes = readNotes(storage);
    const existing = notes.find((note) => note.id === noteId);
    if (!existing) throw new NotFoundError(noteId);
    if (!isNoteEditable(existing)) throw new NoteLockedError();
    const updated: Note = { ...existing, content: clean, updatedAt: new Date().toISOString() };
    const drafts = readDrafts(storage);
    await commit(
      storage,
      { notes, drafts },
      { notes: notes.map((note) => (note.id === noteId ? updated : note)), drafts },
    );
    return { ...updated };
  });
}

/** A member's notes, newest first. */
export function listNotes(memberId: string, storage: NoteStorage): Note[] {
  return readNotes(storage)
    .map((note, index) => ({ note, index }))
    .filter(({ note }) => note.memberId === memberId)
    .sort(
      (a, b) => Date.parse(b.note.createdAt) - Date.parse(a.note.createdAt) || b.index - a.index,
    )
    .map(({ note }) => ({ ...note }));
}

/** Case-insensitive substring match on the raw markdown. Never uses a regular expression. */
export function searchNotes(memberId: string, query: string, storage: NoteStorage): Note[] {
  const notes = listNotes(memberId, storage);
  const needle = query.trim().toLowerCase();
  return needle ? notes.filter((note) => note.content.toLowerCase().includes(needle)) : notes;
}

/** The ids of every note, for checking that a link to one still has somewhere to go. */
export function listNoteIds(storage: NoteStorage): Set<string> {
  return new Set(readNotes(storage).map((note) => note.id));
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
    const notes = readNotes(storage);
    const drafts = readDrafts(storage);
    const next =
      content.trim().length === 0
        ? withoutDraft(drafts, memberId)
        : { ...drafts, [memberId]: content };
    await commit(storage, { notes, drafts }, { notes, drafts: next });
  });
}

/** Removes every note and draft for a member, for when they leave the team. */
export function deleteNotesForMember(memberId: string, storage: NoteStorage): Promise<void> {
  return enqueue(async () => {
    const notes = readNotes(storage);
    const drafts = readDrafts(storage);
    await commit(
      storage,
      { notes, drafts },
      {
        notes: notes.filter((note) => note.memberId !== memberId),
        drafts: withoutDraft(drafts, memberId),
      },
    );
  });
}
