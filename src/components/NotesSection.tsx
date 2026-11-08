import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NOTE_MAX_LENGTH,
  addNote,
  getDraft,
  listNotes,
  saveDraft,
  searchNotes,
  updateNote,
} from '../data/notes';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { formatCount } from '../utils/noteFormat';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/notes.css';
import { ActionItemList } from './ActionItemList';
import { AddActionItem } from './ActionItemInline';
import { SearchIcon } from './icons';
import { MoodPrompt } from './MoodPrompt';
import { NoteEntry } from './NoteEntry';

interface NotesSectionProps {
  memberId: string;
  /** Scrolls to and focuses this note. A new `requestKey` repeats the request. */
  focus?: { noteId: string; requestKey: string } | null;
}

export const AUTOSAVE_DELAY_MS = 2000;
const STATUS_VISIBLE_MS = 2000;
const CLOCK_TICK_MS = 60_000;
const NEAR_LIMIT_CHARACTERS = 500;
const SAVE_FAILED = "Couldn't save your note. Your text is still here, so try again.";
const LOAD_FAILED = "Couldn't open your notes. Lock and unlock Crewbook to try again.";

interface Status {
  label: string;
  visible: boolean;
}

function describeCount(length: number): string {
  const base = `${formatCount(length)} / ${formatCount(NOTE_MAX_LENGTH)}`;
  const remaining = NOTE_MAX_LENGTH - length;
  if (remaining < 0) return `${base}. ${formatCount(-remaining)} characters over the limit`;
  if (remaining <= NEAR_LIMIT_CHARACTERS) {
    return `${base}. ${formatCount(remaining)} ${remaining === 1 ? 'character' : 'characters'} remaining`;
  }
  return base;
}

/** Notes live in the private envelope, so nothing renders until that has been decrypted. */
export function NotesSection({ memberId, focus }: NotesSectionProps) {
  const { isPrivateUnlocked, loadPrivate } = useEncryptedStorage();
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    loadPrivate().catch(() => {
      if (isCurrent) setLoadFailed(true);
    });
    return () => {
      isCurrent = false;
    };
  }, [loadPrivate]);

  if (loadFailed) {
    return (
      <p className="form-error" role="alert">
        {LOAD_FAILED}
      </p>
    );
  }

  if (!isPrivateUnlocked) return <p className="notes__empty">Opening your notes…</p>;

  return <NotesPanel memberId={memberId} focus={focus} />;
}

function NotesPanel({ memberId, focus }: NotesSectionProps) {
  const storage = useEncryptedStorage();
  const [text, setText] = useState(() => getDraft(memberId, storage));
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>({ label: '', visible: false });
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [newestId, setNewestId] = useState<string | null>(null);
  // Set only by saving a note and cleared when the next one is started, so a rating can never be
  // attached to an older note.
  const [moodNoteId, setMoodNoteId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUnsavedDraft = useRef(false);
  const linkedItem = useRef<HTMLLIElement | null>(null);
  const handledFocus = useRef<string | null>(null);
  // Read by the unmount cleanup, which must not capture stale values.
  const latest = useRef({ text, storage });
  useEffect(() => {
    latest.current = { text, storage };
  });

  // Opens a note linked from the meeting history, once, when the list shows it.
  useEffect(() => {
    if (!focus || handledFocus.current === focus.requestKey || !linkedItem.current) return;
    handledFocus.current = focus.requestKey;
    linkedItem.current.scrollIntoView?.({ block: 'center' });
    linkedItem.current.focus({ preventScroll: true });
  });

  // A note can cross the 24 hour mark while the page is open.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  // Leaving the profile writes any unsent text to the encrypted draft instead of dropping it.
  useEffect(
    () => () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (!hasUnsavedDraft.current) return;
      const { text: pending, storage: current } = latest.current;
      saveDraft(memberId, pending, current).catch(() => undefined);
    },
    [memberId],
  );

  const showStatus = useCallback((label: string, autoHide: boolean) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setStatus({ label, visible: true });
    if (autoHide) {
      hideTimer.current = setTimeout(
        () => setStatus((current) => ({ ...current, visible: false })),
        STATUS_VISIBLE_MS,
      );
    }
  }, []);

  const persistDraft = useCallback(
    async (value: string) => {
      hasUnsavedDraft.current = false;
      showStatus('Saving…', false);
      try {
        await saveDraft(memberId, value, latest.current.storage);
        showStatus('Saved', true);
      } catch {
        hasUnsavedDraft.current = true;
        showStatus("Couldn't auto-save", false);
      }
    },
    [memberId, showStatus],
  );

  const handleChange = (value: string) => {
    setText(value);
    setSaveError('');
    setMoodNoteId(null);
    hasUnsavedDraft.current = true;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    if (value.length > NOTE_MAX_LENGTH) return;
    autosaveTimer.current = setTimeout(() => void persistDraft(value), AUTOSAVE_DELAY_MS);
  };

  const trimmedLength = text.trim().length;
  const canSave = trimmedLength > 0 && text.length <= NOTE_MAX_LENGTH && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    hasUnsavedDraft.current = false;
    setIsSaving(true);
    setSaveError('');
    try {
      const note = await addNote(memberId, text, storage);
      setText('');
      setQuery('');
      setNewestId(note.id);
      setMoodNoteId(note.id);
      showStatus('Note saved', true);
      textareaRef.current?.focus();
    } catch {
      hasUnsavedDraft.current = true;
      setSaveError(SAVE_FAILED);
    } finally {
      setIsSaving(false);
    }
  };

  const notes = useMemo(() => listNotes(memberId, storage), [memberId, storage]);
  const isSearching = query.trim().length > 0;
  const visibleNotes = useMemo(
    () => (isSearching ? searchNotes(memberId, query, storage) : notes),
    [isSearching, memberId, query, storage, notes],
  );

  const handleUpdate = useCallback(
    (noteId: string, content: string) => updateNote(noteId, content, storage),
    [storage],
  );

  const resultCount = !isSearching
    ? ''
    : visibleNotes.length === 0
      ? 'No notes found'
      : `${visibleNotes.length} ${visibleNotes.length === 1 ? 'note' : 'notes'} found`;
  const isOver = text.length > NOTE_MAX_LENGTH;

  return (
    <div className="notes">
      <ActionItemList memberId={memberId} />
      <div className="notes__composer">
        <form
          className="notes__form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <label className="sr-only" htmlFor={`notes-input-${memberId}`}>
            1:1 Notes
          </label>
          <textarea
            ref={textareaRef}
            id={`notes-input-${memberId}`}
            className="form-input notes__textarea"
            placeholder="What came up in your 1:1? Markdown is supported."
            value={text}
            aria-describedby={`notes-count-${memberId}`}
            aria-invalid={isOver}
            onChange={(event) => handleChange(event.target.value)}
          />
          <div className="notes__meta">
            <span
              className={`notes__status${status.visible ? ' notes__status--visible' : ''}`}
              role="status"
              aria-live="polite"
            >
              {status.label}
            </span>
            <span
              id={`notes-count-${memberId}`}
              className={`notes__count${isOver ? ' notes__count--over' : ''}`}
            >
              {describeCount(text.length)}
            </span>
          </div>
          {saveError ? (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          ) : null}
          <p className="notes__hint">
            Notes are private to you. Avoid recording sensitive personal details shared in
            confidence.
          </p>
          <div className="notes__actions">
            <button type="submit" className="btn btn-primary" disabled={!canSave}>
              Save Note
            </button>
          </div>
        </form>
        {moodNoteId ? (
          <MoodPrompt key={moodNoteId} memberId={memberId} noteId={moodNoteId} />
        ) : null}
        <AddActionItem memberId={memberId} />
      </div>

      {notes.length === 0 ? (
        <p className="notes__empty">No notes yet. Add your first 1:1 note above.</p>
      ) : (
        <>
          <div className="notes__search">
            <label className="sr-only" htmlFor={`notes-search-${memberId}`}>
              Search notes
            </label>
            <div className="search-field">
              <SearchIcon size={16} />
              <input
                id={`notes-search-${memberId}`}
                type="search"
                className="form-input search-field__input"
                placeholder="Search notes..."
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <p className="notes__result-count" aria-live="polite">
              {resultCount}
            </p>
          </div>
          {visibleNotes.length > 0 ? (
            <ol className="notes__list" reversed aria-label="1:1 notes history">
              {visibleNotes.map((note) => (
                <li
                  key={note.id}
                  ref={note.id === focus?.noteId ? linkedItem : undefined}
                  tabIndex={note.id === focus?.noteId ? -1 : undefined}
                  className={`notes__item${note.id === newestId ? ' notes__item--new' : ''}${note.id === focus?.noteId ? ' notes__item--linked' : ''}`}
                >
                  <NoteEntry note={note} query={query} now={now} onUpdate={handleUpdate} />
                </li>
              ))}
            </ol>
          ) : null}
        </>
      )}
    </div>
  );
}
