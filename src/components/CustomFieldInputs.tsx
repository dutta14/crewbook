import type { CustomFieldDefinition } from '../types/customField';
import { CUSTOM_FIELD_LIMITS } from '../data/customFieldRules';
import { FormField } from './FormField';
import '../styles/form.css';

interface CustomFieldInputsProps {
  idPrefix: string;
  definitions: readonly CustomFieldDefinition[];
  values: Readonly<Record<string, string>>;
  errors: Readonly<Record<string, string>>;
  onChange: (fieldId: string, value: string) => void;
}

export const customFieldInputId = (idPrefix: string, fieldId: string) =>
  `${idPrefix}-cf-${fieldId}`;

/** One input per defined field, shown after a member's standard fields. */
export function CustomFieldInputs({
  idPrefix,
  definitions,
  values,
  errors,
  onChange,
}: CustomFieldInputsProps) {
  return (
    <>
      {definitions.map((field) => {
        const id = customFieldInputId(idPrefix, field.id);
        const value = Object.hasOwn(values, field.id) ? values[field.id] : '';
        const error = errors[field.id];
        const shared = {
          id,
          className: 'form-input',
          value,
          'aria-invalid': error ? (true as const) : undefined,
          'aria-describedby': error ? `${id}-error` : undefined,
        };
        return (
          <FormField key={field.id} id={id} label={field.name} error={error}>
            {field.type === 'select' ? (
              <select {...shared} onChange={(event) => onChange(field.id, event.target.value)}>
                <option value="">None</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...shared}
                type={field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
                autoComplete="off"
                maxLength={field.type === 'text' ? CUSTOM_FIELD_LIMITS.textValueLength : undefined}
                onChange={(event) => onChange(field.id, event.target.value)}
              />
            )}
          </FormField>
        );
      })}
    </>
  );
}
