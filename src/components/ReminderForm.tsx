import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { REMINDER_TEXT_MAX_LENGTH, isTriggerType, type ReminderInput } from '../data/reminders';
import { ValidationError } from '../data/errors';
import type { TeamMember } from '../types/TeamMember';
import type { TriggerType } from '../types/reminder';
import { toIsoDate } from '../utils/scheduleCalculator';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/reminder.css';
import { Avatar } from './Avatar';
import { FormField } from './FormField';
import { Modal } from './Modal';

export const TRIGGER_OPTIONS: Array<{ value: TriggerType; label: string }> = [
  { value: 'next_1on1', label: 'Before next 1:1' },
  { value: 'specific_date', label: 'On a specific date' },
];

export interface ReminderFormProps {
  isOpen: boolean;
  onClose: () => void;
  /** Saves the reminder. Rejects when it could not be saved; a ValidationError is shown in the form. */
  onSubmit: (input: ReminderInput) => Promise<void>;
  members: TeamMember[];
  /** Opened from a profile: the reminder is about this person, who cannot be changed. */
  person?: TeamMember;
  /** Opened from elsewhere: who the person picker starts on. */
  initialPersonId?: string;
  initialText?: string;
}

export function ReminderForm({
  isOpen,
  onClose,
  onSubmit,
  members,
  person,
  initialPersonId,
  initialText,
}: ReminderFormProps) {
  // The dialog stays mounted briefly while it animates out. Each opening gets a fresh form, and
  // once it is gone nothing typed here is left in the DOM or state.
  const [openCount, setOpenCount] = useState(0);
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setOpenCount((count) => count + 1);
  }
  const formId = useId();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Reminder"
      size="md"
      mobileSheet
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className="btn btn-primary">
            Save reminder
          </button>
        </>
      }
    >
      <ReminderFormBody
        key={openCount}
        formId={formId}
        members={members}
        person={person}
        initialPersonId={initialPersonId}
        initialText={initialText}
        onSubmit={onSubmit}
        onClose={onClose}
      />
    </Modal>
  );
}

interface BodyProps extends Omit<ReminderFormProps, 'isOpen'> {
  formId: string;
}

interface FormErrors {
  text?: string;
  person?: string;
  date?: string;
}

function ReminderFormBody({
  formId,
  members,
  person,
  initialPersonId,
  initialText,
  onSubmit,
  onClose,
}: BodyProps) {
  const prefix = useId();
  const [text, setText] = useState(initialText ?? '');
  const [personId, setPersonId] = useState(() =>
    members.some((member) => member.id === initialPersonId) ? (initialPersonId ?? '') : '',
  );
  const [triggerType, setTriggerType] = useState<TriggerType>('next_1on1');
  const [date, setDate] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const personRef = useRef<HTMLSelectElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const ids = {
    text: `${prefix}-text`,
    person: `${prefix}-person`,
    date: `${prefix}-date`,
    hint: `${prefix}-date-hint`,
  };
  const selected = person ?? members.find((member) => member.id === personId);

  const handleTrigger = (event: ChangeEvent<HTMLInputElement>) => {
    if (isTriggerType(event.target.value)) {
      setTriggerType(event.target.value);
      setErrors((current) => ({ ...current, date: undefined }));
    }
  };

  const validate = (): FormErrors => {
    const found: FormErrors = {};
    if (text.trim() === '') found.text = 'Enter a reminder';
    else if (!person && personId === '') found.person = 'Choose who this is about';
    if (triggerType === 'specific_date') {
      if (date === '') found.date = 'Choose a date';
      else if (date < toIsoDate(new Date())) found.date = 'Date must be in the future';
    }
    return found;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError('');

    const found = validate();
    setErrors(found);
    if (found.text) textRef.current?.focus();
    else if (found.person) personRef.current?.focus();
    else if (found.date) dateRef.current?.focus();
    if (found.text || found.person || found.date) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        text,
        linkedPersonId: person?.id ?? personId,
        triggerType,
        ...(triggerType === 'specific_date' ? { triggerDate: date } : {}),
      });
      onClose();
    } catch (error) {
      // The data layer re-validates; its messages never include the reminder. Anything else has
      // already been reported with a toast.
      if (error instanceof ValidationError) setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const describedBy = (...parts: Array<string | false>) => parts.filter(Boolean).join(' ');

  return (
    <form
      id={formId}
      className="member-form"
      noValidate
      autoComplete="off"
      aria-busy={isSubmitting}
      onSubmit={handleSubmit}
    >
      <FormField id={ids.text} label="Reminder" required error={errors.text}>
        <textarea
          ref={textRef}
          id={ids.text}
          className="form-input reminder-form__text"
          autoComplete="off"
          rows={3}
          aria-required="true"
          maxLength={REMINDER_TEXT_MAX_LENGTH}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setErrors((current) => ({ ...current, text: undefined }));
          }}
          {...(errors.text
            ? { 'aria-invalid': true as const, 'aria-describedby': `${ids.text}-error` }
            : {})}
        />
      </FormField>
      <FormField id={ids.person} label="Linked person" error={errors.person}>
        <div className="reminder-form__person">
          {selected ? (
            <Avatar name={selected.name} avatarUrl={selected.avatarUrl} size="sm" aria-hidden />
          ) : null}
          {person ? (
            <input
              id={ids.person}
              type="text"
              className="form-input"
              autoComplete="off"
              readOnly
              value={person.name}
            />
          ) : (
            <select
              ref={personRef}
              id={ids.person}
              className="form-input"
              autoComplete="off"
              value={personId}
              onChange={(event) => {
                setPersonId(event.target.value);
                setErrors((current) => ({ ...current, person: undefined }));
              }}
              {...(errors.person
                ? { 'aria-invalid': true as const, 'aria-describedby': `${ids.person}-error` }
                : {})}
            >
              <option value="">Choose a person</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </FormField>
      <div className="reminder-form__triggers" role="radiogroup" aria-label="Reminder trigger type">
        {TRIGGER_OPTIONS.map((option) => (
          <label key={option.value} className="reminder-form__radio">
            <input
              type="radio"
              name={`${prefix}-trigger`}
              value={option.value}
              checked={triggerType === option.value}
              onChange={handleTrigger}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {triggerType === 'specific_date' ? (
        <div className="form-field reminder-form__date">
          <label className="form-label" htmlFor={ids.date}>
            Date
          </label>
          <input
            ref={dateRef}
            id={ids.date}
            type="date"
            className="form-input"
            autoComplete="off"
            min={toIsoDate(new Date())}
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setErrors((current) => ({ ...current, date: undefined }));
            }}
            aria-describedby={describedBy(ids.hint, !!errors.date && `${ids.date}-error`)}
            {...(errors.date ? { 'aria-invalid': true as const } : {})}
          />
          <span id={ids.hint} className="reminder-form__hint">
            Format: MM/DD/YYYY
          </span>
          {errors.date ? (
            <span id={`${ids.date}-error`} className="form-error">
              {errors.date}
            </span>
          ) : null}
        </div>
      ) : null}
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
    </form>
  );
}
