import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ValidationError } from '../data/errors';
import { FEEDBACK_TEXT_MAX_LENGTH } from '../data/feedbackStore';
import type { FeedbackEntry, FeedbackInput, FeedbackType } from '../types/feedback';
import type { TeamMember } from '../types/TeamMember';
import { toIsoDate } from '../utils/scheduleCalculator';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/feedback.css';
import { FeedbackTagInput } from './FeedbackTagInput';
import { FeedbackTypeControl } from './FeedbackTypeControl';
import { FormField } from './FormField';
import { Modal } from './Modal';

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Saves the entry. Rejects when it could not be saved; a ValidationError is shown in the form. */
  onSubmit: (values: FeedbackInput) => Promise<void>;
  members: Pick<TeamMember, 'id' | 'name'>[];
  /** Pre-selects a person when logging from their profile or roster row. */
  defaultEngineerId?: string;
  /** When provided the form is pre-filled and the entry is edited instead of created. */
  entry?: FeedbackEntry;
}

export function FeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  members,
  defaultEngineerId,
  entry,
}: FeedbackModalProps) {
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
      title={entry ? 'Edit feedback' : 'Log feedback'}
      size="md"
      mobileSheet
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className="btn btn-primary">
            Save feedback
          </button>
        </>
      }
    >
      <FeedbackForm
        key={openCount}
        formId={formId}
        entry={entry}
        members={members}
        defaultEngineerId={defaultEngineerId}
        onSubmit={onSubmit}
        onClose={onClose}
      />
    </Modal>
  );
}

interface FeedbackFormProps extends Pick<
  FeedbackModalProps,
  'onSubmit' | 'entry' | 'members' | 'defaultEngineerId'
> {
  formId: string;
  onClose: () => void;
}

interface Values {
  engineerId: string;
  date: string;
  type: FeedbackType;
  text: string;
  tags: string[];
}

function FeedbackForm({
  formId,
  entry,
  members,
  defaultEngineerId,
  onSubmit,
  onClose,
}: FeedbackFormProps) {
  const prefix = useId();
  const [today] = useState(() => toIsoDate(new Date()));
  const [values, setValues] = useState<Values>(() => ({
    engineerId: entry?.engineerId ?? defaultEngineerId ?? '',
    date: entry?.date ?? today,
    type: entry?.type ?? 'neutral',
    text: entry?.text ?? '',
    tags: entry?.tags ?? [],
  }));
  const [errors, setErrors] = useState<{ engineerId?: string; date?: string; text?: string }>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const personRef = useRef<HTMLSelectElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const ids = {
    person: `${prefix}-person`,
    date: `${prefix}-date`,
    text: `${prefix}-text`,
    tags: `${prefix}-tags`,
  };

  const handle =
    (field: 'engineerId' | 'date' | 'text') =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError('');

    const next: typeof errors = {};
    if (values.engineerId === '') next.engineerId = 'Choose a team member';
    if (values.date === '') next.date = 'Enter the date you saw this';
    else if (values.date > today) next.date = "Date can't be in the future";
    if (values.text.trim() === '') next.text = 'Write an observation before saving';
    if (next.engineerId || next.date || next.text) {
      setErrors(next);
      (next.engineerId ? personRef : next.date ? dateRef : textRef).current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      // The data layer re-validates; its messages never include what was typed. Anything else has
      // already been reported with a toast.
      if (error instanceof ValidationError) setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const invalid = (field: 'engineerId' | 'date' | 'text', id: string) =>
    errors[field] ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` } : {};

  return (
    <form
      id={formId}
      className="member-form"
      noValidate
      autoComplete="off"
      aria-busy={isSubmitting}
      onSubmit={handleSubmit}
    >
      <FormField id={ids.person} label="Person" required error={errors.engineerId}>
        <select
          ref={personRef}
          id={ids.person}
          className="form-input"
          autoComplete="off"
          aria-required="true"
          value={values.engineerId}
          onChange={handle('engineerId')}
          {...invalid('engineerId', ids.person)}
        >
          <option value="">Choose a person</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id={ids.date} label="Date" required error={errors.date}>
        <input
          ref={dateRef}
          id={ids.date}
          type="date"
          className="form-input"
          autoComplete="off"
          aria-required="true"
          max={today}
          value={values.date}
          onChange={handle('date')}
          {...invalid('date', ids.date)}
        />
      </FormField>
      <div className="form-field">
        <span className="form-label">Type</span>
        <FeedbackTypeControl
          value={values.type}
          onChange={(type) => setValues((current) => ({ ...current, type }))}
        />
      </div>
      <FormField id={ids.text} label="What did you observe?" required error={errors.text}>
        <textarea
          ref={textRef}
          id={ids.text}
          className="form-input feedback-form__text"
          autoComplete="off"
          aria-required="true"
          rows={4}
          maxLength={FEEDBACK_TEXT_MAX_LENGTH}
          value={values.text}
          onChange={handle('text')}
          {...invalid('text', ids.text)}
        />
      </FormField>
      <FormField id={ids.tags} label="Tags (optional)">
        <FeedbackTagInput
          id={ids.tags}
          tags={values.tags}
          onChange={(tags) => setValues((current) => ({ ...current, tags }))}
        />
      </FormField>
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
    </form>
  );
}
