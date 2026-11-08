import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Cadence, DayOfWeek, Schedule } from '../types/Schedule';
import {
  CADENCES,
  DAYS_OF_WEEK,
  MAX_CUSTOM_INTERVAL_DAYS,
  applyScheduleEdit,
  isCadence,
  isDayOfWeek,
  isValidInterval,
  isValidTime,
  parseIsoDate,
  reschedule,
  skipNext,
  toIsoDate,
} from '../utils/scheduleCalculator';
import {
  CADENCE_LABELS,
  DAY_LABELS,
  describeCadence,
  describeDayAndTime,
} from '../utils/scheduleFormat';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/schedule-card.css';
import { FormField } from './FormField';
import { NextOneOnOne } from './NextOneOnOne';

interface ScheduleCardProps {
  memberId: string;
  schedule: Schedule | null;
  /** May return a promise; the card stays in edit mode and shows an error if it rejects. */
  onSave: (schedule: Schedule) => void | Promise<unknown>;
}

type Mode = 'display' | 'edit' | 'reschedule';
type FocusTarget = 'primary' | 'reschedule';

interface Draft {
  cadence: Cadence;
  dayOfWeek: DayOfWeek;
  time: string;
  interval: string;
}

interface DraftErrors {
  time?: string;
  interval?: string;
}

const SAVE_FAILED = "Couldn't save the schedule. Try again.";

const toDraft = (schedule: Schedule | null): Draft => ({
  cadence: schedule?.cadence ?? 'weekly',
  dayOfWeek: schedule?.dayOfWeek ?? 'monday',
  time: schedule?.time ?? '10:00',
  interval: String(schedule?.customIntervalDays ?? 14),
});

function validateDraft(draft: Draft): DraftErrors {
  const errors: DraftErrors = {};
  if (!isValidTime(draft.time)) errors.time = 'Enter a meeting time';
  if (draft.cadence === 'custom' && !isValidInterval(Number(draft.interval))) {
    errors.interval = `Enter a whole number of days from 1 to ${MAX_CUSTOM_INTERVAL_DAYS}`;
  }
  return errors;
}

export function ScheduleCard({ memberId, schedule, onSave }: ScheduleCardProps) {
  const prefix = `schedule-${memberId}`;
  const [mode, setMode] = useState<Mode>('display');
  const [draft, setDraft] = useState<Draft>(() => toDraft(schedule));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const cadenceRef = useRef<HTMLSelectElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const rescheduleRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);

  // Focus moves once the new mode has rendered, because the target element may not exist before.
  useEffect(() => {
    if (mode === 'edit') cadenceRef.current?.focus();
    else if (mode === 'reschedule') dateRef.current?.focus();
  }, [mode]);

  // Also depends on `schedule`: the Edit button only exists once a first save reaches the props.
  useEffect(() => {
    if (mode !== 'display' || !pendingFocus.current) return;
    const target = pendingFocus.current === 'reschedule' ? rescheduleRef : primaryRef;
    if (target.current) {
      target.current.focus();
      pendingFocus.current = null;
    }
  }, [mode, schedule]);

  const startEdit = () => {
    setDraft(toDraft(schedule));
    setErrors({});
    setSaveError('');
    setAnnouncement('');
    setMode('edit');
  };

  const returnToDisplay = (target: FocusTarget, message = '') => {
    pendingFocus.current = target;
    setAnnouncement(message);
    setMode('display');
  };

  /** Runs a save; returns whether it succeeded. A failure is reported inline, never with data. */
  const persist = async (next: Schedule, setError: (message: string) => void) => {
    setIsSaving(true);
    try {
      await onSave(next);
      return true;
    } catch {
      setError(SAVE_FAILED);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    const found = validateDraft(draft);
    setErrors(found);
    if (found.time || found.interval) return;
    const interval = Number(draft.interval);
    const next = applyScheduleEdit(schedule, {
      cadence: draft.cadence,
      dayOfWeek: draft.dayOfWeek,
      time: draft.time,
      ...(draft.cadence === 'custom' ? { customIntervalDays: interval } : {}),
    });
    if (await persist(next, setSaveError)) returnToDisplay('primary', 'Schedule saved');
  };

  const handleSkip = async () => {
    if (!schedule || isSaving) return;
    setSaveError('');
    if (await persist(skipNext(schedule), setSaveError)) setAnnouncement('Next 1:1 skipped');
  };

  const startReschedule = () => {
    if (!schedule) return;
    setRescheduleDate(schedule.nextDate);
    setRescheduleError('');
    setAnnouncement('');
    setMode('reschedule');
  };

  const handleReschedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!schedule || isSaving) return;
    const chosen = parseIsoDate(rescheduleDate);
    const today = parseIsoDate(toIsoDate(new Date()));
    if (!chosen || !today || chosen.getTime() < today.getTime()) {
      setRescheduleError('Pick today or a later date');
      return;
    }
    if (await persist(reschedule(schedule, rescheduleDate), setRescheduleError)) {
      returnToDisplay('reschedule', '1:1 rescheduled');
    }
  };

  const describedBy = (field: keyof DraftErrors) =>
    errors[field]
      ? { 'aria-invalid': true as const, 'aria-describedby': `${prefix}-${field}-error` }
      : {};

  const showCustom = draft.cadence === 'custom';

  return (
    <section className="schedule-card" aria-labelledby="schedule-heading">
      <div className="schedule-card__header">
        <h2 id="schedule-heading" className="schedule-card__title">
          1:1 Schedule
        </h2>
        {mode === 'display' && schedule ? (
          <button
            ref={primaryRef}
            type="button"
            className="btn btn-ghost schedule-card__action"
            aria-label="Edit 1:1 schedule"
            onClick={startEdit}
          >
            Edit
          </button>
        ) : null}
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {mode === 'edit' ? (
        <form className="schedule-card__form" onSubmit={handleSave} noValidate>
          <FormField id={`${prefix}-cadence`} label="Cadence">
            <select
              ref={cadenceRef}
              id={`${prefix}-cadence`}
              className="form-input"
              value={draft.cadence}
              onChange={(event) => {
                if (isCadence(event.target.value)) {
                  setDraft({ ...draft, cadence: event.target.value });
                }
              }}
            >
              {CADENCES.map((cadence) => (
                <option key={cadence} value={cadence}>
                  {CADENCE_LABELS[cadence]}
                </option>
              ))}
            </select>
          </FormField>
          {showCustom ? (
            <FormField id={`${prefix}-interval`} label="Interval in days" error={errors.interval}>
              <input
                id={`${prefix}-interval`}
                type="number"
                className="form-input"
                min={1}
                max={MAX_CUSTOM_INTERVAL_DAYS}
                step={1}
                inputMode="numeric"
                value={draft.interval}
                onChange={(event) => setDraft({ ...draft, interval: event.target.value })}
                {...describedBy('interval')}
              />
            </FormField>
          ) : null}
          <FormField id={`${prefix}-day`} label="Day of week">
            <select
              id={`${prefix}-day`}
              className="form-input"
              value={draft.dayOfWeek}
              onChange={(event) => {
                if (isDayOfWeek(event.target.value)) {
                  setDraft({ ...draft, dayOfWeek: event.target.value });
                }
              }}
            >
              {DAYS_OF_WEEK.map((day) => (
                <option key={day} value={day}>
                  {DAY_LABELS[day]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id={`${prefix}-time`} label="Meeting time" error={errors.time}>
            <input
              id={`${prefix}-time`}
              type="time"
              className="form-input"
              value={draft.time}
              onChange={(event) => setDraft({ ...draft, time: event.target.value })}
              {...describedBy('time')}
            />
          </FormField>
          {saveError ? (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="schedule-card__form-actions">
            <button
              type="button"
              className="btn btn-secondary schedule-card__action"
              onClick={() => returnToDisplay('primary')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary schedule-card__action"
              aria-disabled={isSaving}
            >
              Save
            </button>
          </div>
        </form>
      ) : schedule ? (
        <div className="schedule-card__body">
          <dl className="schedule-card__details">
            <div>
              <dt>Cadence</dt>
              <dd>{describeCadence(schedule)}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>{describeDayAndTime(schedule)}</dd>
            </div>
            <div>
              <dt>Next 1:1</dt>
              <dd>
                <NextOneOnOne nextDate={schedule.nextDate} />
              </dd>
            </div>
          </dl>
          {mode === 'reschedule' ? (
            <form className="schedule-card__form" onSubmit={handleReschedule} noValidate>
              <FormField
                id={`${prefix}-reschedule`}
                label="New date for next 1:1"
                error={rescheduleError}
              >
                <input
                  ref={dateRef}
                  id={`${prefix}-reschedule`}
                  type="date"
                  className="form-input"
                  min={toIsoDate(new Date())}
                  value={rescheduleDate}
                  onChange={(event) => setRescheduleDate(event.target.value)}
                  {...(rescheduleError
                    ? {
                        'aria-invalid': true as const,
                        'aria-describedby': `${prefix}-reschedule-error`,
                      }
                    : {})}
                />
              </FormField>
              <div className="schedule-card__form-actions">
                <button
                  type="button"
                  className="btn btn-secondary schedule-card__action"
                  onClick={() => returnToDisplay('reschedule')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary schedule-card__action"
                  aria-disabled={isSaving}
                >
                  Confirm date
                </button>
              </div>
            </form>
          ) : (
            <div className="schedule-card__buttons">
              <button
                type="button"
                className="btn btn-ghost schedule-card__action"
                aria-disabled={isSaving}
                onClick={handleSkip}
              >
                Skip next 1:1
              </button>
              <button
                ref={rescheduleRef}
                type="button"
                className="btn btn-ghost schedule-card__action"
                onClick={startReschedule}
              >
                Reschedule
              </button>
            </div>
          )}
          {saveError && mode === 'display' ? (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="schedule-card__empty">
          <p className="schedule-card__empty-text">No 1:1 schedule set</p>
          <button
            ref={primaryRef}
            type="button"
            className="btn btn-ghost schedule-card__action"
            onClick={startEdit}
          >
            Set up schedule
          </button>
        </div>
      )}
    </section>
  );
}
