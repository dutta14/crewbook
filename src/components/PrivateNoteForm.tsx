import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { PRIVATE_NOTE_MAX_LENGTH } from '../data/privateStore';
import type { FlightRiskLevel } from '../types/flightRisk';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/flight-risk.css';
import { FlightRiskSelector } from './FlightRiskSelector';
import { FormField } from './FormField';

interface PrivateNoteFormProps {
  /** Called with a non-empty draft. The parent asks for confirmation before saving it. */
  onSubmit: (text: string, flightRisk: FlightRiskLevel) => void;
  onCancel: () => void;
  /** A problem the store reported after the draft was submitted. */
  error?: string;
  isBusy?: boolean;
}

const EMPTY_ERROR = 'Write a note before saving';

export function PrivateNoteForm({
  onSubmit,
  onCancel,
  error,
  isBusy = false,
}: PrivateNoteFormProps) {
  const textId = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [flightRisk, setFlightRisk] = useState<FlightRiskLevel>('none');
  const [emptyError, setEmptyError] = useState('');

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const shownError = emptyError || error || '';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (text.trim() === '') {
      setEmptyError(EMPTY_ERROR);
      textRef.current?.focus();
      return;
    }
    onSubmit(text, flightRisk);
  };

  return (
    <form className="private-form" noValidate onSubmit={handleSubmit}>
      <FormField id={textId} label="Private note" required error={shownError}>
        <textarea
          ref={textRef}
          id={textId}
          className="form-input private-form__text"
          // No name and no autocomplete, so the browser never offers an earlier note back.
          autoComplete="off"
          spellCheck={false}
          maxLength={PRIVATE_NOTE_MAX_LENGTH}
          aria-required="true"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setEmptyError('');
          }}
          {...(shownError
            ? { 'aria-invalid': true as const, 'aria-describedby': `${textId}-error` }
            : {})}
        />
      </FormField>
      <FlightRiskSelector value={flightRisk} onChange={setFlightRisk} />
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isBusy}>
          Save note
        </button>
      </div>
    </form>
  );
}
