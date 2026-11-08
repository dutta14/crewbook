import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import '../styles/button.css';
import '../styles/lock-screen.css';
import { ConfirmDialog } from './ConfirmDialog';
import { LockIcon } from './icons';

const WRONG_PASSPHRASE_MESSAGE = 'Wrong passphrase. Try again.';

type Field = 'passphrase' | 'confirm';

interface FieldError {
  field: Field;
  message: string;
}

export function LockScreen() {
  const { isFirstLaunch, isCorrupted, isCryptoSupported, unlock, setup, reset } =
    useEncryptedStorage();
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<FieldError | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const passphraseRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const passphraseId = useId();
  const confirmId = useId();
  const errorId = useId();

  const isSetup = isFirstLaunch;
  const canSubmit = isCryptoSupported && !isCorrupted;

  useEffect(() => {
    passphraseRef.current?.focus();
  }, [isSetup, canSubmit]);

  // Focus returns to the offending field once the inputs are re-enabled after a failed attempt.
  useEffect(() => {
    if (!error || isBusy) return;
    (error.field === 'confirm' ? confirmRef : passphraseRef).current?.focus();
  }, [error, isBusy]);

  const fail = (field: Field, message: string) => {
    setError({ field, message });
    setIsShaking(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    setError(null);

    if (passphrase.length === 0) {
      fail('passphrase', isSetup ? 'Enter a passphrase to continue.' : 'Enter your passphrase.');
      return;
    }
    if (isSetup && passphrase !== confirmation) {
      fail('confirm', "Passphrases don't match.");
      return;
    }

    setIsBusy(true);
    try {
      if (isSetup) {
        await setup(passphrase);
      } else if (!(await unlock(passphrase))) {
        setPassphrase('');
        fail('passphrase', WRONG_PASSPHRASE_MESSAGE);
      }
    } catch {
      fail('passphrase', 'Something went wrong. Try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const clearError = () => {
    if (error) setError(null);
  };

  const describedBy = (field: Field) => (error?.field === field ? errorId : undefined);
  const fieldClass = (field: Field) =>
    error?.field === field && isShaking
      ? 'lock-card__field lock-card__field--shake'
      : 'lock-card__field';

  const renderBody = () => {
    if (!isCryptoSupported) {
      return (
        <p className="lock-card__notice">
          Crewbook needs a secure connection to encrypt your data. Open it over HTTPS or on
          localhost, or switch to a current version of Chrome, Firefox, Safari, or Edge.
        </p>
      );
    }
    if (isCorrupted) {
      return (
        <>
          <p className="lock-card__notice">
            The details needed to unlock your data are missing or damaged. You can erase everything
            stored in this browser and start again.
          </p>
          <button
            type="button"
            className="btn btn-danger lock-card__submit"
            onClick={() => setIsResetOpen(true)}
          >
            Erase and start over
          </button>
          <ConfirmDialog
            isOpen={isResetOpen}
            title="Erase all Crewbook data?"
            message="This permanently deletes everything stored in this browser. It can't be undone."
            confirmLabel="Erase everything"
            onCancel={() => setIsResetOpen(false)}
            onConfirm={() => {
              setIsResetOpen(false);
              reset();
            }}
          />
        </>
      );
    }
    return (
      <form className="lock-card__form" noValidate onSubmit={handleSubmit}>
        <div className={fieldClass('passphrase')} onAnimationEnd={() => setIsShaking(false)}>
          <label className="lock-card__label" htmlFor={passphraseId}>
            Passphrase
          </label>
          <input
            ref={passphraseRef}
            id={passphraseId}
            className="lock-card__input"
            type="password"
            autoComplete="off"
            value={passphrase}
            disabled={isBusy}
            aria-invalid={error?.field === 'passphrase'}
            aria-describedby={describedBy('passphrase')}
            onChange={(event) => {
              setPassphrase(event.target.value);
              clearError();
            }}
          />
        </div>
        {isSetup && (
          <div className={fieldClass('confirm')} onAnimationEnd={() => setIsShaking(false)}>
            <label className="lock-card__label" htmlFor={confirmId}>
              Confirm passphrase
            </label>
            <input
              ref={confirmRef}
              id={confirmId}
              className="lock-card__input"
              type="password"
              autoComplete="off"
              value={confirmation}
              disabled={isBusy}
              aria-invalid={error?.field === 'confirm'}
              aria-describedby={describedBy('confirm')}
              onChange={(event) => {
                setConfirmation(event.target.value);
                clearError();
              }}
            />
          </div>
        )}
        {error && (
          <p id={errorId} className="lock-card__error" role="alert" aria-live="assertive">
            {error.message}
          </p>
        )}
        <button
          type="submit"
          className="btn btn-primary lock-card__submit"
          aria-busy={isBusy}
          aria-disabled={isBusy}
        >
          {isBusy && <span className="lock-card__spinner" aria-hidden="true" />}
          {isBusy ? (isSetup ? 'Setting up…' : 'Unlocking…') : isSetup ? 'Get Started' : 'Unlock'}
        </button>
      </form>
    );
  };

  return (
    <main className="lock-screen">
      <div className="lock-card">
        {!isSetup && <LockIcon size={32} />}
        <h1 className="lock-card__title">{isSetup ? 'Welcome to Crewbook' : 'Crewbook'}</h1>
        {canSubmit && (
          <p className="lock-card__subtitle">
            {isSetup ? 'Set a passphrase to encrypt your data' : 'Enter your passphrase to unlock'}
          </p>
        )}
        {renderBody()}
      </div>
    </main>
  );
}
