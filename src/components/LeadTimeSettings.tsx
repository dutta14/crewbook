import { useId, useState, type FormEvent } from 'react';
import {
  DATE_EVENT_TYPES,
  LEAD_TIME_MAX_DAYS,
  LEAD_TIME_MIN_DAYS,
  getLeadTimeConfig,
  isValidLeadTime,
  setLeadTimeConfig,
} from '../data/dateEvents';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useToast } from '../hooks/useToast';
import type { DateEventType, LeadTimeConfig } from '../types/dateEvent';
import { DATE_EVENT_LABELS } from '../utils/dateEventFormat';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/settings.css';
import '../styles/key-dates.css';

const HEADING_ID = 'lead-times-heading';
const HELP = 'Days before the date to show the reminder';
const RANGE_ERROR = `Enter a whole number from ${LEAD_TIME_MIN_DAYS} to ${LEAD_TIME_MAX_DAYS}`;
const SAVE_FAILED = "Couldn't save the lead times. Try again.";

type Draft = Record<DateEventType, string>;
type Errors = Partial<Record<DateEventType, string>>;

/** A whole number as typed, or NaN for anything else, so "1e1" or "" never counts as a lead time. */
const toDays = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text) : Number.NaN);

function toDraft(config: LeadTimeConfig): Draft {
  return {
    visa_expiry: String(config.visa_expiry),
    probation_end: String(config.probation_end),
    anniversary: String(config.anniversary),
    birthday: String(config.birthday),
  };
}

/** How many days ahead of each date a reminder starts to show. */
export function LeadTimeSettings() {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const prefix = useId();
  const helpId = `${prefix}-help`;
  const [draft, setDraft] = useState<Draft>(() => toDraft(getLeadTimeConfig(storage)));
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    const found: Errors = {};
    const config: Partial<LeadTimeConfig> = {};
    for (const type of DATE_EVENT_TYPES) {
      const days = toDays(draft[type]);
      if (isValidLeadTime(days)) config[type] = days;
      else found[type] = RANGE_ERROR;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setIsSaving(true);
    try {
      await setLeadTimeConfig(config, storage);
      showToast('Lead times saved', 'success');
    } catch {
      showToast(SAVE_FAILED, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="settings-section" aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} className="settings-section__title">
        Reminder Lead Times
      </h2>
      <p id={helpId} className="settings-row__description lead-times__help">
        {HELP}
      </p>
      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <table className="lead-times">
          <thead>
            <tr>
              <th scope="col">Event type</th>
              <th scope="col">Lead time</th>
            </tr>
          </thead>
          <tbody>
            {DATE_EVENT_TYPES.map((type) => {
              const inputId = `${prefix}-${type}`;
              const errorId = `${inputId}-error`;
              const error = errors[type];
              return (
                <tr key={type}>
                  <th scope="row">
                    <label htmlFor={inputId}>{DATE_EVENT_LABELS[type]}</label>
                  </th>
                  <td>
                    <span className="lead-times__control">
                      <input
                        id={inputId}
                        className="form-input lead-times__input"
                        type="number"
                        min={LEAD_TIME_MIN_DAYS}
                        max={LEAD_TIME_MAX_DAYS}
                        step={1}
                        inputMode="numeric"
                        autoComplete="off"
                        value={draft[type]}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `${helpId} ${errorId}` : helpId}
                        onChange={(changed) =>
                          setDraft((current) => ({ ...current, [type]: changed.target.value }))
                        }
                      />
                      <span aria-hidden="true">days</span>
                    </span>
                    {error ? (
                      <span id={errorId} className="form-error lead-times__error" role="alert">
                        {error}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="submit" className="btn btn-primary lead-times__save" disabled={isSaving}>
          Save
        </button>
      </form>
    </section>
  );
}
