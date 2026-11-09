import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useToast } from '../hooks/useToast';
import {
  BackupDecryptError,
  BackupTooLargeError,
  NOT_A_BACKUP_MESSAGE,
  type BackupContainer,
} from '../utils/backupFile';
import { summarizeBackup, type BackupData } from '../utils/backupSchema';
import { BackupValidationError } from '../utils/schemaCheck';
import '../styles/button.css';
import '../styles/data-management.css';
import { FormField } from './FormField';
import { Modal } from './Modal';

export interface DataImportProps {
  checkFile: (file: File) => Promise<BackupContainer>;
  readFile: (container: BackupContainer, passphrase: string) => Promise<BackupData>;
  onImport: (data: BackupData, onProgress: (fraction: number) => void) => Promise<void>;
  /** Runs after a successful restore, so the page can reload what it shows. */
  onImported?: () => void;
}

type Stage = 'idle' | 'invalid' | 'passphrase' | 'preview' | 'importing';

const WRONG_BACKUP_PASSPHRASE =
  "That passphrase didn't open this backup, or the file is damaged. Try again.";
const READ_FAILED = "Couldn't read that backup. Try again.";

function formatExportedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'an unknown date';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function DataImport({ checkFile, readFile, onImport, onImported }: DataImportProps) {
  const { showToast } = useToast();
  const fieldId = useId();
  const formId = useId();
  const warningId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const [stage, setStage] = useState<Stage>('idle');
  const [container, setContainer] = useState<BackupContainer | null>(null);
  const [backup, setBackup] = useState<BackupData | null>(null);
  const [invalidDetail, setInvalidDetail] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The dialogs hand focus back to whatever opened them, which here can be the hidden file input.
  const previousStage = useRef<Stage>('idle');
  useEffect(() => {
    if (stage === 'idle' && previousStage.current !== 'idle') triggerRef.current?.focus();
    previousStage.current = stage;
  }, [stage]);

  const reset = () => {
    setStage('idle');
    setContainer(null);
    setBackup(null);
    setPassphrase('');
    setError(null);
    setInvalidDetail(null);
    setProgress(0);
  };

  const showInvalid = (detail: string | null) => {
    setInvalidDetail(detail && detail !== NOT_A_BACKUP_MESSAGE ? detail : null);
    setStage('invalid');
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const checked = await checkFile(file);
      if (!mounted.current) return;
      setContainer(checked);
      setPassphrase('');
      setError(null);
      setStage('passphrase');
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof BackupTooLargeError) showToast(failure.message, 'error');
      else if (failure instanceof BackupValidationError) showInvalid(null);
      else showToast(READ_FAILED, 'error');
    }
  };

  const submitPassphrase = async (event: FormEvent) => {
    event.preventDefault();
    if (!container || isReading) return;
    if (!passphrase) {
      setError("Enter the backup's passphrase.");
      return;
    }
    setIsReading(true);
    setError(null);
    try {
      const data = await readFile(container, passphrase);
      if (!mounted.current) return;
      setBackup(data);
      setPassphrase('');
      setStage('preview');
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof BackupDecryptError) setError(WRONG_BACKUP_PASSPHRASE);
      else if (failure instanceof BackupValidationError) showInvalid(failure.message);
      else setError(READ_FAILED);
    } finally {
      if (mounted.current) setIsReading(false);
    }
  };

  const confirmImport = async () => {
    if (!backup) return;
    setProgress(0);
    setStage('importing');
    try {
      await onImport(backup, (fraction) => {
        if (mounted.current) setProgress(fraction);
      });
      if (!mounted.current) return;
      reset();
      showToast('Data imported successfully', 'success');
      onImported?.();
    } catch (failure) {
      if (!mounted.current) return;
      reset();
      const reason = failure instanceof Error ? failure.message : 'Something went wrong';
      showToast(`Import failed: ${reason}. Your existing data is unchanged.`, 'error');
    }
  };

  const summary = backup ? summarizeBackup(backup) : null;

  return (
    <>
      <div className="data-row">
        <div className="data-row__text">
          <p className="data-row__label">Restore from backup</p>
          <p className="data-row__description">
            Replaces everything in Crewbook with the contents of a backup file.
          </p>
        </div>
        <button
          ref={triggerRef}
          type="button"
          className="btn btn-secondary data-row__action"
          onClick={() => inputRef.current?.click()}
        >
          Import Data
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json.enc"
          className="sr-only"
          tabIndex={-1}
          aria-label="Select backup file to import"
          onChange={(event) => void handleFile(event)}
        />
      </div>

      <Modal
        isOpen={stage === 'invalid'}
        onClose={reset}
        title="Import Backup"
        size="sm"
        footer={
          <button type="button" className="btn btn-secondary" onClick={reset}>
            Close
          </button>
        }
      >
        <div className="data-banner data-banner--error" role="alert">
          <p>{NOT_A_BACKUP_MESSAGE}</p>
          {invalidDetail ? <p>{invalidDetail}</p> : null}
        </div>
      </Modal>

      <Modal
        isOpen={stage === 'passphrase'}
        onClose={reset}
        title="Backup passphrase"
        size="sm"
        closeOnBackdrop={false}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={reset}>
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              className="btn btn-primary data-busy-btn"
              disabled={isReading}
              aria-busy={isReading}
            >
              {isReading ? (
                <>
                  <span className="data-spinner" aria-hidden="true" />
                  Opening...
                </>
              ) : (
                'Open backup'
              )}
            </button>
          </>
        }
      >
        <form
          id={formId}
          className="data-dialog"
          onSubmit={(event) => void submitPassphrase(event)}
        >
          <FormField id={fieldId} label="Passphrase" required error={error ?? undefined}>
            <input
              id={fieldId}
              className="form-input"
              type="password"
              autoComplete="off"
              value={passphrase}
              disabled={isReading}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${fieldId}-error` : `${fieldId}-hint`}
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </FormField>
          <p id={`${fieldId}-hint`} className="data-hint">
            Enter the passphrase the backup was created with. It may differ from your current one.
          </p>
        </form>
      </Modal>

      <Modal
        isOpen={stage === 'preview'}
        onClose={reset}
        title="Import Backup"
        size="md"
        role="alertdialog"
        describedBy={warningId}
        closeOnBackdrop={false}
        initialFocusRef={cancelRef}
        footer={
          <>
            <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={reset}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={() => void confirmImport()}>
              Replace All Data
            </button>
          </>
        }
      >
        {summary ? (
          <div className="data-dialog">
            <p>This backup was created on {formatExportedAt(summary.exportedAt)} and contains:</p>
            <ul className="data-list">
              {summary.counts.map((line) => (
                <li key={line.id}>
                  {line.count} {line.label}
                </li>
              ))}
            </ul>
            <p>
              {summary.privateDataIncluded
                ? 'It includes private data.'
                : 'It does not include private data. Your current private notes and other private records will be replaced with nothing.'}
            </p>
            <div id={warningId} className="data-banner" role="alert">
              Importing will replace all current data. This cannot be undone.
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={stage === 'importing'}
        onClose={() => undefined}
        title="Importing..."
        size="sm"
        closeOnBackdrop={false}
      >
        <div className="data-dialog">
          <progress
            className="data-progress"
            value={Math.round(progress * 100)}
            max={100}
            aria-label="Import progress"
          />
          <p className="data-hint">Keep this page open until the import finishes.</p>
        </div>
      </Modal>
    </>
  );
}
