import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  GROWTH_CHANGE_TYPES,
  GROWTH_CHANGE_TYPE_LABELS,
  GROWTH_TEXT_MAX_LENGTH,
  isGrowthChangeType,
} from '../data/growthStore';
import { ValidationError } from '../data/errors';
import type { GrowthEntry, GrowthEntryInput } from '../types/growth';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/growth.css';
import { ConfirmDialog } from './ConfirmDialog';
import { FormField } from './FormField';
import { Modal } from './Modal';

export interface GrowthEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Saves the entry. Rejects when it could not be saved; a ValidationError is shown in the form. */
  onSubmit: (values: GrowthEntryInput) => Promise<void>;
  /** When provided the form is pre-filled and the entry is edited instead of created. */
  entry?: GrowthEntry;
  /** Only offered when editing. Rejects when the entry could not be removed. */
  onDelete?: () => Promise<void>;
}

const initialValues = (entry: GrowthEntry | undefined): GrowthEntryInput => ({
  date: entry?.date ?? '',
  changeType: entry?.changeType ?? 'promotion',
  from: entry?.from ?? '',
  to: entry?.to ?? '',
  notes: entry?.notes ?? '',
});

export function GrowthEntryModal({
  isOpen,
  onClose,
  onSubmit,
  entry,
  onDelete,
}: GrowthEntryModalProps) {
  // The dialog stays mounted briefly while it animates out. Each opening gets a fresh form, and
  // once it is gone nothing typed here (the notes especially) is left in the DOM or state.
  const [openCount, setOpenCount] = useState(0);
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setOpenCount((count) => count + 1);
  }
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const formId = useId();
  const canDelete = entry !== undefined && onDelete !== undefined;

  const handleConfirmDelete = async () => {
    setIsConfirmOpen(false);
    try {
      await onDelete?.();
      onClose();
    } catch {
      // The failure has already been reported with a toast; the entry stays as it was.
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={entry ? 'Edit growth entry' : 'Add growth entry'}
        size="md"
        mobileSheet
        footer={
          <>
            {canDelete ? (
              <button
                type="button"
                className="btn btn-danger growth-modal__delete"
                onClick={() => setIsConfirmOpen(true)}
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
        <GrowthEntryForm
          key={openCount}
          formId={formId}
          entry={entry}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      </Modal>
      {canDelete ? (
        <ConfirmDialog
          isOpen={isConfirmOpen}
          onCancel={() => setIsConfirmOpen(false)}
          onConfirm={() => void handleConfirmDelete()}
          title="Delete this growth entry?"
          message="This removes the entry from the timeline. This can't be undone."
          confirmLabel="Delete"
        />
      ) : null}
    </>
  );
}

interface GrowthEntryFormProps extends Pick<GrowthEntryModalProps, 'onSubmit' | 'entry'> {
  formId: string;
  onClose: () => void;
}

function GrowthEntryForm({ formId, entry, onSubmit, onClose }: GrowthEntryFormProps) {
  const prefix = useId();
  const [values, setValues] = useState(() => initialValues(entry));
  const [dateError, setDateError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);

  const ids = {
    date: `${prefix}-date`,
    type: `${prefix}-type`,
    from: `${prefix}-from`,
    to: `${prefix}-to`,
    notes: `${prefix}-notes`,
  };

  const handleText =
    (field: 'date' | 'from' | 'to' | 'notes') =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
      if (field === 'date') setDateError('');
    };

  const handleType = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (isGrowthChangeType(value)) setValues((current) => ({ ...current, changeType: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError('');

    if (values.date === '') {
      setDateError('Enter the date of this change');
      dateRef.current?.focus();
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

  return (
    <form
      id={formId}
      className="member-form"
      noValidate
      autoComplete="off"
      aria-busy={isSubmitting}
      onSubmit={handleSubmit}
    >
      <FormField id={ids.date} label="Date" required error={dateError}>
        <input
          ref={dateRef}
          id={ids.date}
          type="date"
          className="form-input"
          autoComplete="off"
          aria-required="true"
          value={values.date}
          onChange={handleText('date')}
          {...(dateError
            ? { 'aria-invalid': true as const, 'aria-describedby': `${ids.date}-error` }
            : {})}
        />
      </FormField>
      <FormField id={ids.type} label="Change type">
        <select
          id={ids.type}
          className="form-input"
          autoComplete="off"
          value={values.changeType}
          onChange={handleType}
        >
          {GROWTH_CHANGE_TYPES.map((type) => (
            <option key={type} value={type}>
              {GROWTH_CHANGE_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </FormField>
      <div className="growth-form__pair">
        <FormField id={ids.from} label="From">
          <input
            id={ids.from}
            type="text"
            className="form-input"
            autoComplete="off"
            maxLength={GROWTH_TEXT_MAX_LENGTH}
            value={values.from}
            onChange={handleText('from')}
          />
        </FormField>
        <FormField id={ids.to} label="To">
          <input
            id={ids.to}
            type="text"
            className="form-input"
            autoComplete="off"
            maxLength={GROWTH_TEXT_MAX_LENGTH}
            value={values.to}
            onChange={handleText('to')}
          />
        </FormField>
      </div>
      <FormField id={ids.notes} label="Notes">
        <textarea
          id={ids.notes}
          className="form-input growth-form__notes"
          autoComplete="off"
          rows={4}
          maxLength={GROWTH_TEXT_MAX_LENGTH}
          value={values.notes}
          onChange={handleText('notes')}
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
