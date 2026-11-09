import { useState } from 'react';
import { FormField } from './FormField';
import '../styles/form.css';
import '../styles/settings.css';

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  error?: string;
  /** Extra element ids (such as a strength note) that describe the input. */
  describedBy?: string;
  disabled?: boolean;
}

/** A password input with a button that reveals what was typed. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  describedBy,
  disabled = false,
}: PasswordFieldProps) {
  const [isShown, setIsShown] = useState(false);
  const described = [error ? `${id}-error` : null, describedBy].filter(Boolean).join(' ');

  return (
    <FormField id={id} label={label} required error={error}>
      <div className="password-field">
        <input
          id={id}
          className="form-input password-field__input"
          type={isShown ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={described || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="password-field__toggle"
          aria-controls={id}
          disabled={disabled}
          onClick={() => setIsShown((shown) => !shown)}
        >
          {isShown ? 'Hide password' : 'Show password'}
        </button>
      </div>
    </FormField>
  );
}
