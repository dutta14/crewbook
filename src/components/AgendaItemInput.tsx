import { useId, useRef, useState, type FormEvent } from 'react';
import { AGENDA_TEXT_MAX_LENGTH } from '../data/agenda';
import { ValidationError } from '../data/errors';
import type { AgendaItem } from '../types/agenda';
import '../styles/agenda.css';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/utilities.css';

interface AgendaItemInputProps {
  /** Shown as the second choice for who the topic came from. */
  memberName: string;
  /** Rejects when the item was not saved, so the text stays in the field. */
  onAdd: (text: string, addedBy: AgendaItem['addedBy']) => Promise<unknown>;
}

/**
 * One line to add a topic. Enter or the button submits, the field clears and keeps focus for the
 * next one. The manager says whether the topic is theirs or the engineer's, since engineers pass
 * topics on by chat or email and cannot write into this app.
 */
export function AgendaItemInput({ memberName, onAdd }: AgendaItemInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = useId();
  const inputId = `${ids}-input`;
  const errorId = `${ids}-error`;
  const [text, setText] = useState('');
  const [addedBy, setAddedBy] = useState<AgendaItem['addedBy']>('manager');
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isEmpty = text.trim().length === 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isEmpty || isSaving) return;
    const submitted = text.trim();
    setIsSaving(true);
    setError('');
    try {
      await onAdd(submitted, addedBy);
      setText('');
      setAnnouncement(`${submitted} added to agenda`);
    } catch (failure) {
      if (failure instanceof ValidationError) setError(failure.message);
    } finally {
      setIsSaving(false);
      inputRef.current?.focus();
    }
  };

  return (
    <form className="agenda-input" onSubmit={(event) => void handleSubmit(event)}>
      <div className="agenda-input__row">
        <label htmlFor={inputId} className="sr-only">
          Add an agenda item
        </label>
        <input
          id={inputId}
          ref={inputRef}
          className="agenda-input__field"
          type="text"
          value={text}
          maxLength={AGENDA_TEXT_MAX_LENGTH}
          placeholder="Add an agenda item..."
          autoComplete="off"
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setError('');
          }}
        />
        <select
          className="agenda-input__by"
          aria-label="Added by"
          value={addedBy}
          onChange={(event) =>
            setAddedBy(event.target.value === 'engineer' ? 'engineer' : 'manager')
          }
        >
          <option value="manager">Me</option>
          <option value="engineer">{memberName}</option>
        </select>
        <button
          type="submit"
          className="btn btn-primary agenda-input__submit"
          aria-label="Add agenda item"
          disabled={isEmpty || isSaving}
        >
          Add
        </button>
      </div>
      {error ? (
        <p id={errorId} className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </form>
  );
}
