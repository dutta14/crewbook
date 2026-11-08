import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  DATE_EVENT_MAX_YEAR,
  DATE_EVENT_MIN_YEAR,
  isStoredDateEventType,
} from '../data/dateEvents';
import { ValidationError } from '../data/errors';
import { useDateEvents } from '../hooks/useDateEvents';
import type { DateEvent, DateEventType } from '../types/dateEvent';
import type { TeamMember } from '../types/TeamMember';
import { DATE_EVENT_LABELS, isSensitiveDateEvent } from '../utils/dateEventFormat';
import { toIsoDate } from '../utils/scheduleCalculator';
import { formatStartDate } from '../utils/startDate';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/key-dates.css';
import { PencilIcon } from './icons';

interface KeyDatesProps {
  member: TeamMember;
  /** Fixed clock for tests; defaults to the current time. */
  now?: Date;
}

const HEADING_ID = 'key-dates-heading';
const NOT_SET = 'Not set';
const LOAD_FAILED = "Couldn't open your key dates. Lock and unlock Crewbook to try again.";
const SAVE_FAILED = "Couldn't save that date. Try again.";
const MASK = '\u2022\u2022\u2022\u2022\u2022\u2022';

interface DateRowProps {
  event: DateEvent;
  isRevealed: boolean;
  isEditing: boolean;
  today: string;
  onEdit: () => void;
  onCancel: () => void;
  /** Rejects when the date was not saved; the row stays open and shows why. */
  onSave: (date: string | null) => Promise<void>;
}

function DateRow({ event, isRevealed, isEditing, today, onEdit, onCancel, onSave }: DateRowProps) {
  const { type, date } = event;
  const label = DATE_EVENT_LABELS[type];
  const isEditable = isStoredDateEventType(type);
  const isSensitive = isSensitiveDateEvent(type);
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [draft, setDraft] = useState(date ?? '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const formatted = date ? formatStartDate(date) : null;

  // Focus follows the mode once it has rendered, because the target may not exist before.
  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
    else if (wasEditing.current) triggerRef.current?.focus();
    wasEditing.current = isEditing;
  }, [isEditing]);

  const startEdit = () => {
    setDraft(date ?? '');
    setError('');
    onEdit();
  };

  const save = async (next: string | null) => {
    if (isSaving) return;
    if (next === '') {
      setError('Choose a date');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      await onSave(next);
    } catch (failure) {
      setError(failure instanceof ValidationError ? failure.message : SAVE_FAILED);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (submitted: FormEvent) => {
    submitted.preventDefault();
    void save(draft);
  };

  if (isEditing && isEditable) {
    return (
      <div className="key-dates__row key-dates__row--editing">
        <label className="key-dates__label" htmlFor={inputId}>
          {label}
        </label>
        <form className="key-dates__form date-input--entering" onSubmit={handleSubmit} noValidate>
          <input
            ref={inputRef}
            id={inputId}
            className="form-input key-dates__input"
            type="date"
            autoComplete="off"
            min={`${DATE_EVENT_MIN_YEAR}-01-01`}
            max={type === 'birthday' ? today : `${DATE_EVENT_MAX_YEAR}-12-31`}
            value={draft}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(changed) => setDraft(changed.target.value)}
          />
          <div className="key-dates__actions">
            <button type="submit" className="btn btn-primary key-dates__button" disabled={isSaving}>
              Save
            </button>
            <button
              type="button"
              className="btn btn-secondary key-dates__button"
              onClick={onCancel}
            >
              Cancel
            </button>
            {date ? (
              <button
                type="button"
                className="btn btn-ghost key-dates__button"
                aria-label={`Clear ${label}`}
                disabled={isSaving}
                onClick={() => void save(null)}
              >
                Clear
              </button>
            ) : null}
          </div>
          {error ? (
            <span id={errorId} className="form-error key-dates__error" role="alert">
              {error}
            </span>
          ) : null}
        </form>
      </div>
    );
  }

  if (!isEditable) {
    return (
      <div
        className="key-dates__row"
        role="group"
        aria-label={formatted ? `${label}: ${formatted}, auto-calculated` : `${label}: ${NOT_SET}`}
      >
        <span className="key-dates__label" aria-hidden="true">
          {label}
        </span>
        <span className="key-dates__value">
          <span className={formatted ? undefined : 'key-dates__empty'} aria-hidden="true">
            {formatted ?? NOT_SET}
          </span>
          {formatted ? (
            <span className="key-dates__auto" aria-hidden="true">
              auto
            </span>
          ) : null}
        </span>
      </div>
    );
  }

  return (
    <div className="key-dates__row">
      <span className="key-dates__label">{label}</span>
      <span className="key-dates__value">
        {date && formatted ? (
          isSensitive && !isRevealed ? (
            <>
              <span aria-hidden="true">{MASK}</span>
              <span className="sr-only">Hidden</span>
            </>
          ) : (
            <time className={isSensitive ? 'sensitive-date-value' : undefined} dateTime={date}>
              {formatted}
            </time>
          )
        ) : (
          <button
            ref={triggerRef}
            type="button"
            className="key-dates__unset"
            aria-label={`Set ${label}`}
            onClick={startEdit}
          >
            {NOT_SET}
          </button>
        )}
      </span>
      {date ? (
        <button
          ref={triggerRef}
          type="button"
          className="key-dates__edit"
          aria-label={`Edit ${label}`}
          onClick={startEdit}
        >
          <PencilIcon size={16} />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Dates the manager tracks for one person. Visa and probation dates stay masked until the manager
 * asks to see them, and the choice is forgotten when they leave the profile.
 */
export function KeyDates({ member, now }: KeyDatesProps) {
  const { isReady, loadFailed, events, setDate } = useDateEvents(member.id, now);
  const [editing, setEditing] = useState<DateEventType | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const today = toIsoDate(now ?? new Date());
  const hasSensitiveDate = events.some((event) => isSensitiveDateEvent(event.type) && event.date);

  const startEdit = (type: DateEventType) => {
    // Editing shows the current value, so the rest of the sensitive dates are no longer hidden.
    if (isSensitiveDateEvent(type)) setIsRevealed(true);
    setAnnouncement('');
    setEditing(type);
  };

  const save = async (type: DateEventType, date: string | null) => {
    await setDate(type, date);
    setEditing(null);
    setAnnouncement(`${DATE_EVENT_LABELS[type]} ${date === null ? 'cleared' : 'saved'}`);
  };

  return (
    <section className="key-dates" aria-labelledby={HEADING_ID}>
      <div className="key-dates__header">
        <h3 id={HEADING_ID} className="key-dates__title">
          Key Dates
        </h3>
        {hasSensitiveDate ? (
          <button
            type="button"
            className="btn btn-ghost key-dates__reveal"
            onClick={() => setIsRevealed((current) => !current)}
          >
            {isRevealed ? 'Hide sensitive dates' : 'Show sensitive dates'}
          </button>
        ) : null}
      </div>
      {loadFailed ? (
        <p className="form-error" role="alert">
          {LOAD_FAILED}
        </p>
      ) : !isReady ? (
        <p className="key-dates__empty">Opening your key dates…</p>
      ) : (
        <div className="key-dates__fields">
          {events.map((event) => (
            <DateRow
              key={event.type}
              event={event}
              isRevealed={isRevealed}
              isEditing={editing === event.type}
              today={today}
              onEdit={() => startEdit(event.type)}
              onCancel={() => setEditing(null)}
              onSave={(date) => save(event.type, date)}
            />
          ))}
        </div>
      )}
      <div className="sr-only" role="status">
        {announcement}
      </div>
    </section>
  );
}
