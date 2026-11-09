import { describe, expect, it, vi } from 'vitest';
import type { Note } from '../types/Note';
import { createNote } from '../test-utils/factories';
import { StorageWriteError } from '../utils/encryptedStorage';
import { NotFoundError, ValidationError } from './errors';
import {
  EDIT_WINDOW_MS,
  NOTE_MAX_LENGTH,
  EMPTY_SESSION_NOTE,
  NoteLockedError,
  addNote,
  deleteNotesForMember,
  getDraft,
  isNoteEditable,
  listNotes,
  saveDraft,
  saveLiveSession,
  searchNotes,
  updateNote,
  type NoteStorage,
} from './notes';

const ALEX = 'alex';
const PRIYA = 'priya';

function createStorage(
  initial: Record<string, unknown> = {},
  failure: StorageWriteError | null = null,
) {
  const data = new Map<string, unknown>(Object.entries(initial));
  const flush = vi.fn(async () => failure);
  const storage: NoteStorage = {
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, flush };
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

describe('isNoteEditable', () => {
  it('is true inside the 24 hour window and false from the boundary on', () => {
    const created = '2026-01-07T10:00:00.000Z';
    const at = Date.parse(created);

    expect(isNoteEditable({ createdAt: created }, at + EDIT_WINDOW_MS - 1)).toBe(true);
    expect(isNoteEditable({ createdAt: created }, at + EDIT_WINDOW_MS)).toBe(false);
  });

  it('treats an unreadable timestamp as locked', () => {
    expect(isNoteEditable({ createdAt: 'not a date' })).toBe(false);
  });
});

describe('addNote', () => {
  it('stores the raw markdown with matching timestamps and flushes', async () => {
    const { storage, flush } = createStorage();

    const note = await addNote(ALEX, '## Goals\n**ship it**', storage);

    expect(note).toMatchObject({ memberId: ALEX, content: '## Goals\n**ship it**' });
    expect(note.createdAt).toBe(note.updatedAt);
    expect(listNotes(ALEX, storage)).toEqual([note]);
    expect(flush).toHaveBeenCalled();
  });

  it.each(['', '   \n\t'])('rejects a blank note (%j)', async (content) => {
    const { storage } = createStorage();

    await expect(addNote(ALEX, content, storage)).rejects.toThrow(ValidationError);
    expect(listNotes(ALEX, storage)).toEqual([]);
  });

  it('rejects a note over the limit without echoing it', async () => {
    const { storage } = createStorage();
    const content = 'x'.repeat(NOTE_MAX_LENGTH + 1);

    const failure = await addNote(ALEX, content, storage).catch((error: Error) => error);

    expect(failure).toBeInstanceOf(ValidationError);
    expect((failure as Error).message).not.toContain('xxx');
  });

  it('accepts a note of exactly the limit', async () => {
    const { storage } = createStorage();

    await expect(addNote(ALEX, 'x'.repeat(NOTE_MAX_LENGTH), storage)).resolves.toBeDefined();
  });

  it('archives that person’s agenda because a new 1:1 starts a new agenda', async () => {
    const agenda = (id: string, memberId: string) => ({
      id,
      memberId,
      text: 'Topic',
      addedBy: 'manager',
      createdAt: '2026-01-05T09:00:00Z',
    });
    const { storage, data } = createStorage({
      agendaItems: [agenda('a1', ALEX), agenda('p1', PRIYA)],
    });

    await addNote(ALEX, 'done', storage);

    expect(data.get('agendaItems')).toEqual([
      expect.objectContaining({ id: 'a1', archived: true }),
      agenda('p1', PRIYA),
    ]);
  });

  it('discards the member draft in the same write', async () => {
    const { storage } = createStorage({ noteDrafts: { [ALEX]: 'half', [PRIYA]: 'other' } });

    await addNote(ALEX, 'done', storage);

    expect(getDraft(ALEX, storage)).toBe('');
    expect(getDraft(PRIYA, storage)).toBe('other');
  });

  it('restores the previous notes and rethrows when the write fails', async () => {
    const existing = createNote({ memberId: ALEX });
    const failure = new StorageWriteError(false, false);
    const { storage } = createStorage({ notes: [existing] }, failure);

    await expect(addNote(ALEX, 'new', storage)).rejects.toBe(failure);

    expect(listNotes(ALEX, storage)).toEqual([existing]);
  });
});

describe('updateNote', () => {
  it('changes the content and updatedAt but keeps createdAt', async () => {
    const original = createNote({ memberId: ALEX, createdAt: hoursAgo(1), updatedAt: hoursAgo(1) });
    const { storage } = createStorage({ notes: [original] });

    const updated = await updateNote(original.id, 'revised', storage);

    expect(updated).toMatchObject({ content: 'revised', createdAt: original.createdAt });
    expect(updated.updatedAt).not.toBe(original.updatedAt);
    expect(listNotes(ALEX, storage)[0].content).toBe('revised');
  });

  it('throws NoteLockedError for a note older than 24 hours and leaves it unchanged', async () => {
    const old = createNote({ memberId: ALEX, createdAt: hoursAgo(25), content: 'original' });
    const { storage } = createStorage({ notes: [old] });

    await expect(updateNote(old.id, 'tampered', storage)).rejects.toThrow(NoteLockedError);

    expect(listNotes(ALEX, storage)[0].content).toBe('original');
  });

  it('throws NotFoundError for an unknown note and ValidationError for a blank edit', async () => {
    const note = createNote({ memberId: ALEX });
    const { storage } = createStorage({ notes: [note] });

    await expect(updateNote('missing', 'x', storage)).rejects.toThrow(NotFoundError);
    await expect(updateNote(note.id, '  ', storage)).rejects.toThrow(ValidationError);
  });
});

describe('listNotes and searchNotes', () => {
  const notes: Note[] = [
    createNote({
      id: 'a',
      memberId: ALEX,
      content: 'Promotion Talk',
      createdAt: '2026-01-05T10:00:00.000Z',
    }),
    createNote({
      id: 'b',
      memberId: ALEX,
      content: 'Vacation plans',
      createdAt: '2026-01-07T10:00:00.000Z',
    }),
    createNote({
      id: 'c',
      memberId: PRIYA,
      content: 'Promotion',
      createdAt: '2026-01-06T10:00:00.000Z',
    }),
  ];

  it("lists one member's notes newest first", () => {
    const { storage } = createStorage({ notes });

    expect(listNotes(ALEX, storage).map((note) => note.id)).toEqual(['b', 'a']);
  });

  it('ignores malformed stored entries', () => {
    const { storage } = createStorage({ notes: [...notes, { id: 5 }, null] });

    expect(listNotes(ALEX, storage)).toHaveLength(2);
  });

  it('returns an empty list when nothing is stored', () => {
    expect(listNotes(ALEX, createStorage().storage)).toEqual([]);
  });

  it('searches case-insensitively within one member only', () => {
    const { storage } = createStorage({ notes });

    expect(searchNotes(ALEX, 'PROMOTION', storage).map((note) => note.id)).toEqual(['a']);
  });

  it('treats the query as plain text and returns everything for a blank one', () => {
    const { storage } = createStorage({ notes });

    expect(searchNotes(ALEX, '.*', storage)).toEqual([]);
    expect(searchNotes(ALEX, '  ', storage)).toHaveLength(2);
  });
});

describe('drafts', () => {
  it('saves and reads a draft per member', async () => {
    const { storage } = createStorage();

    await saveDraft(ALEX, 'in progress', storage);

    expect(getDraft(ALEX, storage)).toBe('in progress');
    expect(getDraft(PRIYA, storage)).toBe('');
  });

  it('removes the draft when it is cleared to blank', async () => {
    const { storage } = createStorage({ noteDrafts: { [ALEX]: 'text' } });

    await saveDraft(ALEX, '   ', storage);

    expect(getDraft(ALEX, storage)).toBe('');
  });

  it('rejects a draft over the limit', async () => {
    const { storage } = createStorage();

    await expect(saveDraft(ALEX, 'x'.repeat(NOTE_MAX_LENGTH + 1), storage)).rejects.toThrow(
      ValidationError,
    );
  });

  it('never reads inherited properties as a draft', () => {
    expect(getDraft('constructor', createStorage().storage)).toBe('');
  });
});

describe('deleteNotesForMember', () => {
  it("removes that member's notes and draft but not anyone else's", async () => {
    const { storage } = createStorage({
      notes: [createNote({ memberId: ALEX }), createNote({ memberId: PRIYA })],
      noteDrafts: { [ALEX]: 'draft' },
    });

    await deleteNotesForMember(ALEX, storage);

    expect(listNotes(ALEX, storage)).toEqual([]);
    expect(getDraft(ALEX, storage)).toBe('');
    expect(listNotes(PRIYA, storage)).toHaveLength(1);
  });
});

describe('saveLiveSession', () => {
  const session = (content: string) => ({
    memberId: ALEX,
    content,
    captures: [],
    startedAt: '2026-01-07T10:00:00.000Z',
    endedAt: '2026-01-07T10:30:00.000Z',
  });

  it('saves the trimmed notes as a note and clears the draft', async () => {
    const { storage } = createStorage();
    await saveDraft(ALEX, 'half-typed', storage);

    const saved = await saveLiveSession(session('  Talked about growth.\n\n'), storage);

    expect(saved.content).toBe('Talked about growth.');
    expect(listNotes(ALEX, storage)).toHaveLength(1);
    expect(getDraft(ALEX, storage)).toBe('');
  });

  it('still records that the 1:1 happened when nothing was written', async () => {
    const { storage } = createStorage();

    const saved = await saveLiveSession(session('   '), storage);

    expect(saved.content).toBe(EMPTY_SESSION_NOTE);
  });
});
