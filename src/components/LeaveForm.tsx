import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ValidationError } from '../data/errors';
import { isLeaveType, LEAVE_TYPE_LABELS, LEAVE_TYPES, type LeaveInput } from '../data/leave';
import type { LeaveEntry } from '../types/leave';
import type { TeamMember } from '../types/TeamMember';
import '../styles/button.css';
import '../styles/calendar.css';
import '../styles/form.css';
import { Avatar } from './Avatar';
import { FormField } from './FormField';
import { Modal } from './Modal';

export interface LeaveFormProps {
  isOpen: boolean;
  onClose: () => void;
  /** Saves the leave. Rejects when it could not be saved; a ValidationError is shown in the form. */
  onSubmit: (input: LeaveInput) => Promise<void>;
  members: TeamMember[];
  /** When provided the form is pre-filled and this entry is edited instead of a new one added. */
  entry?: LeaveEntry;
  /** YYYY-MM-DD used for both dates when adding. */
  defaultDate: string;
  /** Edit mode only. The caller confirms, then deletes. */
  onRequestDelete?: (entry: LeaveEntry) => void;
}

interface FormValues {
  memberId: string;
  startDate: string;
  endDate: string;
  type: LeaveInput['type'];
}

const initialValues = (
  entry: LeaveEntry | undefined,
  members: TeamMember[],
  defaultDate: string,
): FormValues => ({
  memberId: members.some((member) => member.id === entry?.memberId) ? (entry?.memberId ?? '') : '',
  startDate: entry?.startDate ?? defaultDate,
  endDate: entry?.endDate ?? defaultDate,
  type: entry?.type ?? 'pto',
});

export function LeaveForm({
  isOpen,
  onClose,
  onSubmit,
  members,
  entry,
  defaultDate,
  onRequestDelete,
}: LeaveFormProps) {
  // The dialog stays mounted briefly while it animates out. Each opening gets a fresh form.
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
      title={entry ? 'Edit Leave' : 'Add Leave'}
      size="md"
      mobileSheet
      footer={
        <>
          {entry && onRequestDelete ? (
            <button
              type="button"
              className="btn btn-danger leave-form__delete"
              onClick={() => onRequestDelete(entry)}
            >
              Delete
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className="btn btn-primary">
            Save
          </button>
        </>
      }
    >
      <LeaveFormBody
        key={openCount}
        formId={formId}
        entry={entry}
        members={members}
        defaultDate={defaultDate}
        onSubmit={onSubmit}
        onClose={onClose}
      />
    </Modal>
  );
}

interface LeaveFormBodyProps extends Pick<
  LeaveFormProps,
  'onSubmit' | 'members' | 'entry' | 'defaultDate' | 'onClose'
> {
  formId: string;
}

function LeaveFormBody({
  formId,
  entry,
  members,
  defaultDate,
  onSubmit,
  onClose,
}: LeaveFormBodyProps) {
  const prefix = useId();
  const [values, setValues] = useState(() => initialValues(entry, members, defaultDate));
  const [errors, setErrors] = useState<
    Partial<Record<'memberId' | 'startDate' | 'endDate', string>>
  >({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const personRef = useRef<HTMLSelectElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  const ids = {
    memberId: `${prefix}-person`,
    startDate: `${prefix}-start`,
    endDate: `${prefix}-end`,
    type: `${prefix}-type`,
  };
  const person = members.find((member) => member.id === values.memberId);

  const invalid = (field: keyof typeof errors) =>
    errors[field]
      ? { 'aria-invalid': true as const, 'aria-describedby': `${ids[field]}-error` }
      : {};

  const clearError = (field: keyof typeof errors) =>
    setErrors((current) => ({ ...current, [field]: undefined }));

  const handlePerson = (event: ChangeEvent<HTMLSelectElement>) => {
    setValues((current) => ({ ...current, memberId: event.target.value }));
    clearError('memberId');
  };

  const handleStart = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setValues((current) => {
      // The end follows the start while it has not been set apart, and never ends up before it.
      const follows =
        current.endDate === '' || current.endDate === current.startDate || current.endDate < value;
      return { ...current, startDate: value, endDate: follows && value ? value : current.endDate };
    });
    clearError('startDate');
    clearError('endDate');
  };

  const handleEnd = (event: ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, endDate: event.target.value }));
    clearError('endDate');
  };

  const handleType = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (isLeaveType(value)) setValues((current) => ({ ...current, type: value }));
  };

  const validate = () => {
    const found: typeof errors = {};
    if (values.memberId === '') found.memberId = 'Choose who is out';
    if (values.startDate === '') found.startDate = 'Enter a start date';
    if (values.endDate === '') found.endDate = 'Enter an end date';
    else if (values.startDate !== '' && values.endDate < values.startDate) {
      found.endDate = "End date can't be before the start date";
    }
    return found;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError('');

    const found = validate();
    setErrors(found);
    if (found.memberId) return personRef.current?.focus();
    if (found.startDate) return startRef.current?.focus();
    if (found.endDate) return endRef.current?.focus();

    setIsSubmitting(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      // The data layer re-validates and its messages never repeat stored values. Anything else
      // has already been reported with a toast.
      if (error instanceof ValidationError) setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      id={formId}
      className="member-form"
      noValidate
      autoComplete="off"
      aria-busy={isSubmitting}
      onSubmit={handleSubmit}
    >
      <FormField id={ids.memberId} label="Person" required error={errors.memberId}>
        <div className="leave-form__person">
          {person ? (
            <Avatar name={person.name} avatarUrl={person.avatarUrl} size="sm" aria-hidden />
          ) : null}
          <select
            ref={personRef}
            id={ids.memberId}
            className="form-input"
            autoComplete="off"
            aria-required="true"
            value={values.memberId}
            onChange={handlePerson}
            {...invalid('memberId')}
          >
            <option value="">Select a person</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      </FormField>
      <div className="leave-form__pair">
        <FormField id={ids.startDate} label="Start" required error={errors.startDate}>
          <input
            ref={startRef}
            id={ids.startDate}
            type="date"
            className="form-input"
            autoComplete="off"
            aria-required="true"
            value={values.startDate}
            onChange={handleStart}
            {...invalid('startDate')}
          />
        </FormField>
        <FormField id={ids.endDate} label="End" required error={errors.endDate}>
          <input
            ref={endRef}
            id={ids.endDate}
            type="date"
            className="form-input"
            autoComplete="off"
            aria-required="true"
            min={values.startDate || undefined}
            value={values.endDate}
            onChange={handleEnd}
            {...invalid('endDate')}
          />
        </FormField>
      </div>
      <FormField id={ids.type} label="Type">
        <select
          id={ids.type}
          className="form-input"
          autoComplete="off"
          value={values.type}
          onChange={handleType}
        >
          {LEAVE_TYPES.map((type) => (
            <option key={type} value={type}>
              {LEAVE_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </FormField>
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
    </form>
  );
}
