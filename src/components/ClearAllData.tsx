import { useEffect, useId, useRef, useState } from 'react';
import { clearCollapseState } from '../data/dashboardCollapse';
import { clearPrepDismissal } from '../data/prepDismissal';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { resetTheme } from '../hooks/useDarkMode';
import { constantTimeEqual } from '../utils/passphrase';
import { FormField } from './FormField';
import { Modal } from './Modal';
import '../styles/button.css';
import '../styles/data-management.css';
import '../styles/form.css';
import '../styles/settings.css';

export const CLEAR_CONFIRMATION_WORD = 'DELETE';
export const CLEARED_REMINDER =
  'App data cleared. Note: any previously exported files (CSV or backup) on your device still contain data and must be deleted separately.';
const CLEAR_FAILED = "Couldn't clear your data. Nothing more was changed. Try again.";

interface ClearAllDataProps {
  /** Seconds the final button stays locked once DELETE is typed. */
  countdownSeconds?: number;
  /** Called after the data is gone, so the page can reload what it shows. */
  onCleared: () => void;
  /** Show the follow-up reminder. The page keeps this, since it reloads after a clear. */
  showReminder: boolean;
}

type Step = 'closed' | 'warn' | 'confirm';

/** Wipes both encrypted envelopes, share links included, behind a two-step confirmation. */
export function ClearAllData({ countdownSeconds = 3, onCleared, showReminder }: ClearAllDataProps) {
  const storage = useEncryptedStorage();
  const [step, setStep] = useState<Step>('closed');
  const [typed, setTyped] = useState('');
  const [remaining, setRemaining] = useState(countdownSeconds);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const warningId = useId();
  const inputId = useId();
  const instructionId = `${inputId}-instruction`;
  const countdownId = `${inputId}-countdown`;
  const isMatch = constantTimeEqual(typed, CLEAR_CONFIRMATION_WORD);
  const isReady = isMatch && remaining === 0 && !isClearing;

  // The countdown only runs while the word is right. Typing anything else resets it (see below).
  useEffect(() => {
    if (!isMatch) return undefined;
    const interval = setInterval(() => {
      setRemaining((seconds) => {
        if (seconds <= 1) clearInterval(interval);
        return Math.max(seconds - 1, 0);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isMatch]);

  useEffect(() => {
    if (step === 'confirm') inputRef.current?.focus();
  }, [step]);

  const handleTyped = (value: string) => {
    setTyped(value);
    if (!constantTimeEqual(value, CLEAR_CONFIRMATION_WORD)) setRemaining(countdownSeconds);
  };

  const close = () => {
    if (isClearing) return;
    setStep('closed');
    setTyped('');
    setRemaining(countdownSeconds);
    setError('');
  };

  const open = () => {
    setTyped('');
    setRemaining(countdownSeconds);
    setError('');
    setStep('warn');
  };

  const clear = async () => {
    // aria-disabled leaves the button clickable, so the guard has to live here too.
    if (!isReady) return;
    setIsClearing(true);
    setError('');
    try {
      await storage.clearAllData();
      clearCollapseState();
      clearPrepDismissal();
      resetTheme();
      setIsClearing(false);
      setStep('closed');
      setTyped('');
      onCleared();
    } catch {
      setIsClearing(false);
      setError(CLEAR_FAILED);
    }
  };

  return (
    <div className="danger-zone">
      <div className="settings-row">
        <div className="settings-row__text">
          <h3 className="settings-subtitle">Clear all data</h3>
          <p className="settings-row__description">
            Permanently deletes your team, notes, private data and share links from this browser.
          </p>
        </div>
        <button type="button" className="btn btn-danger" onClick={open}>
          Clear All Data
        </button>
      </div>
      {showReminder ? (
        <p className="data-banner settings-reminder" role="status">
          {CLEARED_REMINDER}
        </p>
      ) : null}

      <Modal
        isOpen={step === 'warn'}
        onClose={close}
        title="Clear all data?"
        size="sm"
        role="alertdialog"
        describedBy={warningId}
        closeOnBackdrop={false}
        initialFocusRef={cancelRef}
        footer={
          <>
            <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={close}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setStep('confirm')}>
              Continue
            </button>
          </>
        }
      >
        <div id={warningId} className="data-banner" role="alert">
          <p>
            This deletes everything Crewbook has stored on this device: your team, notes, mood
            entries, private data and every share link. It cannot be undone.
          </p>
          <p>Export a backup first if you might want any of it back.</p>
        </div>
      </Modal>

      <Modal
        isOpen={step === 'confirm'}
        onClose={close}
        title="Delete everything"
        size="sm"
        role="alertdialog"
        describedBy={instructionId}
        closeOnBackdrop={false}
        initialFocusRef={inputRef}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              aria-disabled={!isReady}
              aria-describedby={instructionId}
              onClick={() => void clear()}
            >
              Delete Everything
            </button>
          </>
        }
      >
        <div className="data-dialog">
          <div className="data-banner data-banner--error">
            <p>Last chance. Everything will be erased and there is no way to bring it back.</p>
          </div>
          <FormField id={inputId} label={`Type ${CLEAR_CONFIRMATION_WORD} to confirm`}>
            <input
              ref={inputRef}
              id={inputId}
              className="form-input"
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={typed}
              disabled={isClearing}
              onChange={(event) => handleTyped(event.target.value)}
            />
          </FormField>
          <p id={instructionId} className="data-hint">
            The button unlocks when you type {CLEAR_CONFIRMATION_WORD} in capital letters.
          </p>
          {isMatch && remaining > 0 ? (
            <p id={countdownId} className="data-hint" role="status">
              Delete Everything unlocks in {remaining} {remaining === 1 ? 'second' : 'seconds'}.
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
