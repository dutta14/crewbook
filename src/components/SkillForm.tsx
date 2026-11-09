import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  PROFICIENCY_LABELS,
  PROFICIENCY_LEVELS,
  SKILL_NAME_MAX_LENGTH,
  SKILL_NOTES_MAX_LENGTH,
  isProficiencyLevel,
} from '../data/skillsStore';
import { ValidationError } from '../data/errors';
import type { ProficiencyLevel } from '../types/skill';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/pages/skills.css';
import { FormField } from './FormField';

export interface SkillFormValues {
  name: string;
  level: ProficiencyLevel;
  notes: string;
}

interface SkillFormProps {
  initial?: SkillFormValues;
  /** Saves the skill. Rejects when it could not be saved; a ValidationError is shown in the form. */
  onSubmit: (values: SkillFormValues) => Promise<void>;
  onCancel: () => void;
}

const EMPTY: SkillFormValues = { name: '', level: 'learning', notes: '' };

/** Adds a skill or edits one in place. The caller closes it once `onSubmit` resolves. */
export function SkillForm({ initial = EMPTY, onSubmit, onCancel }: SkillFormProps) {
  const prefix = useId();
  const [values, setValues] = useState(initial);
  const [nameError, setNameError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    nameRef.current?.focus();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const ids = { name: `${prefix}-name`, level: `${prefix}-level`, notes: `${prefix}-notes` };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (values.name.trim() === '') {
      setNameError('Enter a skill name');
      nameRef.current?.focus();
      return;
    }
    setNameError('');
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error) {
      // The data layer re-validates; its messages never include what was typed. Anything else has
      // already been reported with a toast.
      if (error instanceof ValidationError && isMounted.current) {
        setNameError(error.message);
        nameRef.current?.focus();
      }
    } finally {
      if (isMounted.current) setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- only listens for Escape
    <form
      className="skill-form"
      noValidate
      autoComplete="off"
      aria-busy={isSubmitting}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      <FormField id={ids.name} label="Skill name" required error={nameError}>
        <input
          ref={nameRef}
          id={ids.name}
          type="text"
          className="form-input"
          autoComplete="off"
          aria-required="true"
          maxLength={SKILL_NAME_MAX_LENGTH}
          value={values.name}
          onChange={(event) => {
            const { value } = event.target;
            setValues((current) => ({ ...current, name: value }));
            setNameError('');
          }}
          {...(nameError
            ? { 'aria-invalid': true as const, 'aria-describedby': `${ids.name}-error` }
            : {})}
        />
      </FormField>
      <FormField id={ids.level} label="Proficiency level">
        <select
          id={ids.level}
          className="form-input"
          value={values.level}
          onChange={(event) => {
            const { value } = event.target;
            if (isProficiencyLevel(value)) setValues((current) => ({ ...current, level: value }));
          }}
        >
          {PROFICIENCY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {PROFICIENCY_LABELS[level]}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id={ids.notes} label="Notes (optional)">
        <textarea
          id={ids.notes}
          className="form-input skill-form__notes"
          autoComplete="off"
          rows={3}
          maxLength={SKILL_NOTES_MAX_LENGTH}
          value={values.notes}
          onChange={(event) => {
            const { value } = event.target;
            setValues((current) => ({ ...current, notes: value }));
          }}
        />
      </FormField>
      <div className="skill-form__footer">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          Save
        </button>
      </div>
    </form>
  );
}
