import { useId, useState, type FormEvent } from 'react';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useToast } from '../hooks/useToast';
import { WrongPassphraseError } from '../utils/encryptedStorage';
import {
  constantTimeEqual,
  getPassphraseStrength,
  validateNewPassphrase,
} from '../utils/passphrase';
import { EncryptionProgressModal } from './EncryptionProgressModal';
import { PasswordField } from './PasswordField';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/settings.css';

interface FieldErrors {
  current?: string;
  next?: string;
  confirm?: string;
}

const WRONG_CURRENT = 'Current passphrase is incorrect';
const CHANGE_FAILED = 'Passphrase change failed. Your data is safe with your current passphrase.';

/** Re-encrypts all data under a new passphrase. Fields are cleared on success and on cancel. */
export function ChangePassphrase() {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const id = useId();
  const ids = { current: `${id}-current`, next: `${id}-new`, confirm: `${id}-confirm` };
  const strengthId = `${id}-strength`;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState('');
  const [progress, setProgress] = useState(0);
  const [isBusy, setIsBusy] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setErrors({});
    setFailure('');
  };

  const focusField = (field: keyof FieldErrors) => {
    // Wait a frame so the error renders first and a screen reader reads it with the field.
    requestAnimationFrame(() => document.getElementById(ids[field])?.focus());
  };

  const validate = (): FieldErrors => {
    const found: FieldErrors = {};
    if (current.length === 0) found.current = 'Enter your current passphrase';
    const nextProblem = validateNewPassphrase(next);
    if (nextProblem) found.next = nextProblem;
    else if (constantTimeEqual(next, current)) {
      found.next = 'Choose a passphrase different from your current one';
    }
    if (!found.next && !constantTimeEqual(confirm, next)) {
      found.confirm = 'Passphrases do not match';
    }
    return found;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isBusy) return;
    setFailure('');
    const found = validate();
    setErrors(found);
    const firstInvalid = (['current', 'next', 'confirm'] as const).find((field) => found[field]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    setProgress(0);
    setIsBusy(true);
    try {
      await storage.changePassphrase(current, next, setProgress);
      reset();
      showToast('Passphrase updated', 'success');
    } catch (error) {
      if (error instanceof WrongPassphraseError) {
        setErrors({ current: WRONG_CURRENT });
        focusField('current');
      } else {
        setFailure(CHANGE_FAILED);
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <form
      className="passphrase-form"
      aria-labelledby={`${id}-title`}
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      <h3 id={`${id}-title`} className="settings-subtitle">
        Change passphrase
      </h3>
      <p className="settings-row__description">
        Re-encrypts everything in this browser. Share links you created earlier stop working, so
        create new ones afterwards.
      </p>
      <PasswordField
        id={ids.current}
        label="Current passphrase"
        autoComplete="current-password"
        value={current}
        onChange={setCurrent}
        error={errors.current}
        disabled={isBusy}
      />
      <PasswordField
        id={ids.next}
        label="New passphrase"
        autoComplete="new-password"
        value={next}
        onChange={setNext}
        error={errors.next}
        describedBy={next ? strengthId : undefined}
        disabled={isBusy}
      />
      {next ? (
        <p id={strengthId} className="passphrase-strength">
          Strength: <strong>{getPassphraseStrength(next)}</strong>
        </p>
      ) : null}
      <PasswordField
        id={ids.confirm}
        label="Confirm new passphrase"
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
        error={errors.confirm}
        disabled={isBusy}
      />
      {failure ? (
        <p className="form-error" role="alert">
          {failure}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" disabled={isBusy} onClick={reset}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isBusy}>
          Update
        </button>
      </div>
      <EncryptionProgressModal isOpen={isBusy} progress={progress} />
    </form>
  );
}
