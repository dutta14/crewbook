import { useEffect, useMemo, useRef, useState } from 'react';
import { NOTE_MAX_LENGTH, NoteLockedError, isNoteEditable } from '../data/notes';
import type { Note, NoteVisibility } from '../types/Note';
import { highlightMatches, renderMarkdown } from '../utils/markdownRenderer';
import { formatCount, formatNoteDate } from '../utils/noteFormat';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/notes.css';
import '../styles/note-visibility.css';
import { ClockIcon, EyeIcon, LockIcon, PencilIcon } from './icons';
import { NoteVisibilityToggle } from './NoteVisibilityToggle';

interface NoteEntryProps {
  note: Note;
  /** Shown in the tooltip and in the confirmation before the note is shared. */
  engineerName: string;
  /** Matches of this text are highlighted in the body. */
  query?: string;
  /** Epoch milliseconds for the 24 hour check; defaults to the current time. */
  now?: number;
  /** Rejects when the note could not be saved; the entry stays in edit mode. */
  onUpdate: (noteId: string, content: string) => Promise<unknown>;
  onSetVisibility: (noteId: string, visibility: NoteVisibility) => unknown;
}

const SAVE_FAILED = "Couldn't save your changes. Try again.";
const NOW_LOCKED = 'This note is now locked and can no longer be edited.';

export function NoteEntry({
  note,
  engineerName,
  query = '',
  now,
  onUpdate,
  onSetVisibility,
}: NoteEntryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const returnFocus = useRef(false);

  const dateLabel = formatNoteDate(note.createdAt);
  const isEditable = isNoteEditable(note, now);
  const html = useMemo(
    () => highlightMatches(renderMarkdown(note.content), query),
    [note.content, query],
  );

  useEffect(() => {
    if (isEditing) {
      const textarea = textareaRef.current;
      textarea?.focus();
      textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
    } else if (returnFocus.current) {
      returnFocus.current = false;
      editRef.current?.focus();
    }
  }, [isEditing]);

  const startEdit = () => {
    setDraft(note.content);
    setError('');
    setIsEditing(true);
  };

  const stopEdit = () => {
    returnFocus.current = true;
    setIsEditing(false);
  };

  const canSave = draft.trim().length > 0 && draft.length <= NOTE_MAX_LENGTH && !isSaving;

  const save = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setError('');
    try {
      await onUpdate(note.id, draft);
      stopEdit();
    } catch (failure) {
      setError(failure instanceof NoteLockedError ? NOW_LOCKED : SAVE_FAILED);
    } finally {
      setIsSaving(false);
    }
  };

  const inputId = `note-edit-${note.id}`;
  const isShared = note.visibility === 'shared';

  return (
    <article
      className={`note-entry note-entry--${isShared ? 'shared' : 'private'}`}
      aria-label={isShared ? 'Shared note' : 'Private note'}
    >
      <header className="note-entry__header">
        <div className="note-entry__meta">
          <span
            className={`note-entry__visibility note-entry__visibility--${isShared ? 'shared' : 'private'}`}
            aria-hidden="true"
          >
            {isShared ? <EyeIcon size={14} /> : <LockIcon size={14} />}
          </span>
          <time className="note-entry__date" dateTime={note.createdAt}>
            {dateLabel}
          </time>
          {note.updatedAt !== note.createdAt ? (
            <span className="note-entry__edited">Edited</span>
          ) : null}
        </div>
        <div className="note-entry__controls">
          {isEditing ? null : isEditable ? (
            <button
              ref={editRef}
              type="button"
              className="icon-btn note-entry__edit"
              aria-label={`Edit note from ${dateLabel}`}
              onClick={startEdit}
            >
              <PencilIcon size={16} />
            </button>
          ) : (
            <span
              className="note-entry__locked"
              role="img"
              aria-label="This note is locked and can no longer be edited"
            >
              <ClockIcon size={12} />
              <span aria-hidden="true">Locked</span>
            </span>
          )}
          <NoteVisibilityToggle
            noteId={note.id}
            visibility={note.visibility}
            engineerName={engineerName}
            onToggle={onSetVisibility}
          />
        </div>
      </header>
      {isEditing ? (
        <form
          className="note-entry__form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="sr-only" htmlFor={inputId}>
            {`Edit note from ${dateLabel}`}
          </label>
          <textarea
            ref={textareaRef}
            id={inputId}
            className="form-input notes__textarea"
            value={draft}
            aria-invalid={draft.length > NOTE_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                stopEdit();
              }
            }}
          />
          <span
            className={`notes__count${draft.length > NOTE_MAX_LENGTH ? ' notes__count--over' : ''}`}
          >
            {formatCount(draft.length)} / {formatCount(NOTE_MAX_LENGTH)}
          </span>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="note-entry__actions">
            <button type="button" className="btn btn-secondary" onClick={stopEdit}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSave}>
              Save changes
            </button>
          </div>
        </form>
      ) : (
        // renderMarkdown output is sanitized with DOMPurify; highlightMatches only adds <mark>.
        <div className="note-entry__body" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </article>
  );
}
