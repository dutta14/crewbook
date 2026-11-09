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
  listNoteIds,
  listNotes,
  listSharedNotes,
  saveDraft,
  saveLiveSession,
  searchNotes,
  setNoteVisibility,
  setVisibilityForMember,
  updateNote,
  type NoteStorage,
} from './notes';

const ALEX = 'alex';
const PRIYA = 'priya';

function createStorage(
  initial: Record<string, unknown> = {},
  failure: StorageWriteError | null = null,
  mainInitial: Record<string, unknown> = {},
) {
  const data = new Map<string, unknown>(Object.entries(initial));
  const main = new Map<string, unknown>(Object.entries(mainInitial));
  const flush = vi.fn(async () => failure);
  const storage: NoteStorage = {
    get: <T>(key: string) => (main.has(key) ? (main.get(key) as T) : null),
    set: <T>(key: string, value: T) => void main.set(key, value),
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, main, flush };
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

describe('note visibility', () => {
  const SECRET = 'SENTINEL-PRIVATE-TEXT';
  const stamp = '2026-03-01T10:00:00.000Z';
  const stored = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    memberId: ALEX,
    content: `${id} ${SECRET}`,
    createdAt: stamp,
    updatedAt: stamp,
    ...extra,
  });

  it('saves a new note as private in the private envelope by default', async () => {
    const { storage, data, main } = createStorage();

    const note = await addNote(ALEX, 'hello', storage);

    expect(note.visibility).toBe('private');
    expect(data.get('notes')).toEqual([note]);
    expect(main.get('sharedNotes')).toBeUndefined();
    expect(listSharedNotes(ALEX, storage)).toEqual([]);
  });

  it('saves a note as shared in the main envelope only when asked', async () => {
    const { storage, data, main } = createStorage();

    const note = await addNote(ALEX, 'hello', storage, 'shared');

    expect(note.visibility).toBe('shared');
    expect(main.get('sharedNotes')).toEqual([note]);
    expect(data.get('notes')).toEqual([]);
    expect(listSharedNotes(ALEX, storage)).toEqual([note]);
  });

  it('follows the default visibility setting when none is given', async () => {
    const { storage } = createStorage({}, null, { settings: { defaultNoteVisibility: 'shared' } });

    const note = await addNote(ALEX, 'hello', storage);

    expect(note.visibility).toBe('shared');
  });

  it.each(['Shared', '', null, 1, true, {}])(
    'rejects an invalid visibility (%j) instead of guessing',
    async (visibility) => {
      const { storage } = createStorage();

      await expect(addNote(ALEX, 'hello', storage, visibility as never)).rejects.toThrow(
        ValidationError,
      );
      expect(listNotes(ALEX, storage)).toEqual([]);
    },
  );

  it('reads notes saved before visibility existed as private', () => {
    const { storage } = createStorage({ notes: [stored('old')] });

    expect(listNotes(ALEX, storage)[0].visibility).toBe('private');
    expect(listSharedNotes(ALEX, storage)).toEqual([]);
  });

  it('never treats a private-envelope note as shared, whatever its stored field says', () => {
    const { storage } = createStorage({
      notes: [
        stored('a', { visibility: 'shared' }),
        stored('b', { shared: true, isShared: true }),
        stored('c', { visibility: 'SHARED' }),
      ],
    });

    expect(listNotes(ALEX, storage).every((note) => note.visibility === 'private')).toBe(true);
    expect(listSharedNotes(ALEX, storage)).toEqual([]);
  });

  it('lists only the right member’s shared notes and never copies stray stored fields', () => {
    const { storage } = createStorage({ notes: [stored('p')] }, null, {
      sharedNotes: [stored('s', { secret: SECRET }), stored('t', { memberId: PRIYA })],
    });

    const shared = listSharedNotes(ALEX, storage);

    expect(shared.map((note) => note.id)).toEqual(['s']);
    expect(Object.keys(shared[0]).sort()).toEqual(
      ['content', 'createdAt', 'id', 'memberId', 'updatedAt', 'visibility'].sort(),
    );
  });

  it('counts a note found on both sides as private', () => {
    const { storage } = createStorage({ notes: [stored('dup')] }, null, {
      sharedNotes: [stored('dup')],
    });

    expect(listNotes(ALEX, storage)).toHaveLength(1);
    expect(listNotes(ALEX, storage)[0].visibility).toBe('private');
    expect(listSharedNotes(ALEX, storage)).toEqual([]);
  });

  it('moves a note to the main envelope when shared and back when made private', async () => {
    const { storage, data, main } = createStorage({ notes: [stored('n1')] });

    const shared = await setNoteVisibility('n1', 'shared', storage);
    expect(shared.visibility).toBe('shared');
    expect(data.get('notes')).toEqual([]);
    expect((main.get('sharedNotes') as Note[]).map((note) => note.id)).toEqual(['n1']);

    const hidden = await setNoteVisibility('n1', 'private', storage);
    expect(hidden.visibility).toBe('private');
    expect(main.get('sharedNotes')).toEqual([]);
    expect((data.get('notes') as Note[]).map((note) => note.id)).toEqual(['n1']);
    expect(listSharedNotes(ALEX, storage)).toEqual([]);
  });

  it('keeps the text and timestamps when visibility changes, even on a locked note', async () => {
    const old = createNote({
      id: 'locked',
      memberId: ALEX,
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(48),
    });
    const { storage } = createStorage({ notes: [old] });

    await setNoteVisibility('locked', 'shared', storage);

    const [moved] = listSharedNotes(ALEX, storage);
    expect(moved).toMatchObject({
      content: old.content,
      createdAt: old.createdAt,
      updatedAt: old.updatedAt,
    });
    await expect(updateNote('locked', 'rewrite', storage)).rejects.toThrow(NoteLockedError);
  });

  it('writes the destination copy before removing the original', async () => {
    const { storage, data, main, flush } = createStorage({ notes: [stored('n1')] });
    const seen: Array<{ hidden: number; shared: number }> = [];
    flush.mockImplementation(async () => {
      seen.push({
        hidden: (data.get('notes') as Note[]).length,
        shared: ((main.get('sharedNotes') as Note[] | undefined) ?? []).length,
      });
      return null;
    });

    await setNoteVisibility('n1', 'shared', storage);

    expect(seen).toEqual([
      { hidden: 1, shared: 1 },
      { hidden: 0, shared: 1 },
    ]);
  });

  it('does nothing when the note is already on the requested side', async () => {
    const { storage, flush } = createStorage({ notes: [stored('n1')] });

    await setNoteVisibility('n1', 'private', storage);

    expect(flush).not.toHaveBeenCalled();
  });

  it('rejects an unknown note and an invalid visibility', async () => {
    const { storage } = createStorage({ notes: [stored('n1')] });

    await expect(setNoteVisibility('missing', 'shared', storage)).rejects.toThrow(NotFoundError);
    await expect(setNoteVisibility('n1', 'public' as never, storage)).rejects.toThrow(
      ValidationError,
    );
    expect(listSharedNotes(ALEX, storage)).toEqual([]);
  });

  it('leaves the note private when the move cannot be saved', async () => {
    const failure = new StorageWriteError(false, false);
    const { storage, data, main } = createStorage({ notes: [stored('n1')] }, failure);

    await expect(setNoteVisibility('n1', 'shared', storage)).rejects.toBe(failure);

    expect((data.get('notes') as Note[]).map((note) => note.id)).toEqual(['n1']);
    expect(main.get('sharedNotes')).toEqual([]);
    expect(listSharedNotes(ALEX, storage)).toEqual([]);
  });

  it('shares every note of one person at once and leaves other people alone', async () => {
    const { storage } = createStorage({
      notes: [stored('a'), stored('b'), stored('c', { memberId: PRIYA })],
    });

    const moved = await setVisibilityForMember(ALEX, 'shared', storage);

    expect(moved).toBe(2);
    expect(listSharedNotes(ALEX, storage)).toHaveLength(2);
    expect(listSharedNotes(PRIYA, storage)).toEqual([]);
    expect(listNotes(PRIYA, storage)[0].visibility).toBe('private');
  });

  it('makes every shared note of one person private at once and reports zero when none moved', async () => {
    const { storage } = createStorage({}, null, { sharedNotes: [stored('a'), stored('b')] });

    expect(await setVisibilityForMember(ALEX, 'private', storage)).toBe(2);
    expect(listSharedNotes(ALEX, storage)).toEqual([]);
    expect(await setVisibilityForMember(ALEX, 'private', storage)).toBe(0);
  });

  it('rolls the whole bulk change back when it cannot be saved', async () => {
    const failure = new StorageWriteError(false, false);
    const { storage, data, main } = createStorage({ notes: [stored('a'), stored('b')] }, failure);

    await expect(setVisibilityForMember(ALEX, 'shared', storage)).rejects.toBe(failure);

    expect(data.get('notes')).toHaveLength(2);
    expect(main.get('sharedNotes')).toEqual([]);
    expect(listSharedNotes(ALEX, storage)).toEqual([]);
  });

  it('keeps a note when only the second write of a move fails, and reads it as private', async () => {
    const failure = new StorageWriteError(false, false);
    const { storage, data, main, flush } = createStorage({ notes: [stored('n1')] });
    flush.mockResolvedValueOnce(null).mockResolvedValueOnce(failure).mockResolvedValue(null);

    await expect(setNoteVisibility('n1', 'shared', storage)).rejects.toBe(failure);

    expect((data.get('notes') as Note[]).map((note) => note.id)).toEqual(['n1']);
    expect(main.get('sharedNotes')).toEqual([]);
    expect(listSharedNotes(ALEX, storage)).toEqual([]);
  });

  it('edits a shared note in place without changing its visibility', async () => {
    const { storage } = createStorage({}, null, {
      sharedNotes: [stored('s', { createdAt: hoursAgo(1), updatedAt: hoursAgo(1) })],
    });

    const updated = await updateNote('s', 'changed', storage);

    expect(updated.visibility).toBe('shared');
    expect(listSharedNotes(ALEX, storage)[0].content).toBe('changed');
  });

  it('deletes a member’s shared notes along with the private ones', async () => {
    const { storage, main } = createStorage({ notes: [stored('p')] }, null, {
      sharedNotes: [stored('s'), stored('o', { memberId: PRIYA })],
    });

    await deleteNotesForMember(ALEX, storage);

    expect(listNotes(ALEX, storage)).toEqual([]);
    expect((main.get('sharedNotes') as Note[]).map((note) => note.id)).toEqual(['o']);
  });

  it('includes shared notes when looking up every note id', () => {
    const { storage } = createStorage({ notes: [stored('p')] }, null, {
      sharedNotes: [stored('s')],
    });

    expect(listNoteIds(storage)).toEqual(new Set(['p', 's']));
  });
});
