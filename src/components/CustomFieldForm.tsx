import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  CUSTOM_FIELD_LIMITS,
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPE_LABELS,
  cleanFieldInput,
  isCustomFieldType,
} from '../data/customFieldRules';
import { ValidationError } from '../data/errors';
import type {
  CustomFieldDefinition,
  CustomFieldInput,
  CustomFieldType,
} from '../types/customField';
import { FormField } from './FormField';
import '../styles/custom-fields.css';

interface CustomFieldFormProps {
  /** The field being edited; omit to add a new one. */
  field?: CustomFieldDefinition;
  existing: readonly CustomFieldDefinition[];
  onSave: (input: CustomFieldInput) => Promise<void>;
  onCancel: () => void;
}

export function CustomFieldForm({ field, existing, onSave, onCancel }: CustomFieldFormProps) {
  const [name, setName] = useState(field?.name ?? '');
  const [type, setType] = useState<CustomFieldType>(field?.type ?? 'text');
  const [optionsText, setOptionsText] = useState((field?.options ?? []).join('\n'));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => nameRef.current?.focus(), []);
  const optionsRef = useRef<HTMLTextAreaElement>(null);
  const prefix = field ? `custom-field-edit-${field.id}` : 'custom-field-new';
  const isOptionsError = type === 'select' && error !== null && /option/i.test(error);
  const nameError = error !== null && !isOptionsError ? error : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const input: CustomFieldInput =
      type === 'select' ? { name, type, options: optionsText.split('\n') } : { name, type };
    try {
      const clean = cleanFieldInput(input, existing, field?.id);
      setError(null);
      setSaving(true);
      await onSave(clean);
    } catch (caught) {
      setSaving(false);
      if (!(caught instanceof ValidationError)) return;
      setError(caught.message);
      const optionsProblem = type === 'select' && /option/i.test(caught.message);
      (optionsProblem ? optionsRef : nameRef).current?.focus();
    }
  };

  return (
    <form className="custom-field-form" onSubmit={(event) => void submit(event)} noValidate>
      <FormField id={`${prefix}-name`} label="Field name" required error={nameError}>
        <input
          ref={nameRef}
          id={`${prefix}-name`}
          className="form-input"
          value={name}
          maxLength={CUSTOM_FIELD_LIMITS.nameLength}
          autoComplete="off"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${prefix}-name-error` : undefined}
          onChange={(event) => setName(event.target.value)}
        />
      </FormField>
      <FormField id={`${prefix}-type`} label="Type">
        <select
          id={`${prefix}-type`}
          className="form-input"
          value={type}
          onChange={(event) => {
            if (isCustomFieldType(event.target.value)) setType(event.target.value);
            setError(null);
          }}
        >
          {CUSTOM_FIELD_TYPES.map((option) => (
            <option key={option} value={option}>
              {CUSTOM_FIELD_TYPE_LABELS[option]}
            </option>
          ))}
        </select>
      </FormField>
      {type === 'select' ? (
        <FormField
          id={`${prefix}-options`}
          label="Options (one per line)"
          required
          error={isOptionsError ? (error ?? undefined) : undefined}
        >
          <textarea
            ref={optionsRef}
            id={`${prefix}-options`}
            className="form-input"
            rows={4}
            value={optionsText}
            aria-label="Select options, one per line"
            aria-invalid={isOptionsError ? true : undefined}
            aria-describedby={isOptionsError ? `${prefix}-options-error` : undefined}
            onChange={(event) => setOptionsText(event.target.value)}
          />
        </FormField>
      ) : null}
      {field ? (
        <p className="custom-field-form__note">
          Changing the type or removing options clears any values that no longer fit.
        </p>
      ) : null}
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" aria-disabled={saving || undefined}>
          Save Field
        </button>
      </div>
    </form>
  );
}
