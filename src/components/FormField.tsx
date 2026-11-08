import type { ReactNode } from 'react';
import '../styles/form.css';

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

/** A label above a control, with an inline error below it. The control links to `${id}-error`. */
export function FormField({ id, label, required = false, error, children }: FormFieldProps) {
  return (
    <div className="form-field">
      <label className="form-label" htmlFor={id}>
        {label}
        {required ? (
          <>
            {' '}
            <span aria-hidden="true">*</span>
          </>
        ) : null}
      </label>
      {children}
      {error ? (
        <span id={`${id}-error`} className="form-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
