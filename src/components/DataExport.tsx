import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { CountLine } from '../data/envelopeSchema';
import { useToast } from '../hooks/useToast';
import { BackupTooLargeError } from '../utils/backupFile';
import { WrongPassphraseError } from '../utils/encryptedStorage';
import { CSV_UNENCRYPTED_REMINDER } from '../utils/exportCSV';
import type { ExportPreview, ExportResult } from '../utils/exportBackup';
import '../styles/button.css';
import '../styles/data-management.css';
import { ConfirmDialog } from './ConfirmDialog';
import { FormField } from './FormField';
import { Modal } from './Modal';

export interface DataExportProps {
  lastBackupAt: string | null;
  getPreview: () => Promise<ExportPreview>;
  onExport: (passphrase: string) => Promise<ExportResult>;
  /** Saves the roster CSV and returns the file name. */
  onExportCsv: () => string;
}

const WRONG_PASSPHRASE = "That isn't the passphrase you unlock Crewbook with. Try again.";
const EXPORT_FAILED = "Couldn't create the backup. Your data is unchanged. Try again.";
const PREVIEW_FAILED = "Couldn't read your data to prepare the backup. Try again.";

function formatBackupDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function CountList({ lines }: { lines: CountLine[] }) {
  return (
    <ul className="data-list">
      {lines.map((line) => (
        <li key={line.id}>
          {line.count} {line.label}
        </li>
      ))}
    </ul>
  );
}

export function DataExport({ lastBackupAt, getPreview, onExport, onExportCsv }: DataExportProps) {
  const { showToast } = useToast();
  const formId = useId();
  const fieldId = useId();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCsvOpen, setIsCsvOpen] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const openDialog = () => {
    setPassphrase('');
    setError(null);
    setPreview(null);
    setPreviewFailed(false);
    setIsDialogOpen(true);
    getPreview().then(
      (next) => {
        if (mounted.current) setPreview(next);
      },
      () => {
        if (mounted.current) setPreviewFailed(true);
      },
    );
  };

  const closeDialog = () => {
    if (isExporting) return;
    setIsDialogOpen(false);
    setPassphrase('');
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isExporting) return;
    if (!passphrase) {
      setError('Enter your passphrase to create the backup.');
      return;
    }
    setIsExporting(true);
    setError(null);
    try {
      const result = await onExport(passphrase);
      if (!mounted.current) return;
      setIsDialogOpen(false);
      setPassphrase('');
      showToast(
        result.privateDataIncluded
          ? `Backup saved as ${result.fileName}`
          : `Backup saved as ${result.fileName}. Private data could not be read, so it was left out.`,
        'success',
      );
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof WrongPassphraseError) setError(WRONG_PASSPHRASE);
      else if (failure instanceof BackupTooLargeError) setError(failure.message);
      else setError(EXPORT_FAILED);
    } finally {
      if (mounted.current) setIsExporting(false);
    }
  };

  const confirmCsv = () => {
    setIsCsvOpen(false);
    try {
      const fileName = onExportCsv();
      showToast(`Saved ${fileName}. ${CSV_UNENCRYPTED_REMINDER}.`, 'success');
    } catch {
      showToast("Couldn't create the CSV. Try again.", 'error');
    }
  };

  const privateLines = preview?.privateCounts.filter((line) => line.count > 0) ?? [];

  return (
    <>
      <div className="data-row">
        <div className="data-row__text">
          <p className="data-row__label">Full backup</p>
          <p className="data-row__description">
            An encrypted file with everything in Crewbook, including your private notes.
          </p>
          <p className="data-row__description">
            Last backup: {lastBackupAt ? formatBackupDate(lastBackupAt) : 'Never'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary data-row__action"
          disabled={isExporting}
          onClick={openDialog}
        >
          Export Data
        </button>
      </div>
      <div className="data-row">
        <div className="data-row__text">
          <p className="data-row__label">Roster spreadsheet</p>
          <p className="data-row__description">
            Names, roles, levels, emails and status only. This file is not encrypted.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary data-row__action"
          onClick={() => setIsCsvOpen(true)}
        >
          Download CSV (Unencrypted)
        </button>
      </div>

      <Modal
        isOpen={isDialogOpen}
        onClose={closeDialog}
        title="Export Data"
        size="sm"
        closeOnBackdrop={false}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isExporting}
              onClick={closeDialog}
            >
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              className="btn btn-primary data-busy-btn"
              disabled={isExporting}
              aria-busy={isExporting}
              aria-label={isExporting ? 'Exporting data, please wait' : undefined}
            >
              {isExporting ? (
                <>
                  <span className="data-spinner" aria-hidden="true" />
                  Exporting...
                </>
              ) : (
                'Export backup'
              )}
            </button>
          </>
        }
      >
        <form id={formId} className="data-dialog" onSubmit={(event) => void submit(event)}>
          <div className="data-banner" role="note">
            <p>
              This backup includes your private data. Anyone with the file and your passphrase can
              read it.
            </p>
            {privateLines.length > 0 ? <CountList lines={privateLines} /> : null}
            {preview && !preview.privateAvailable ? (
              <p>Your private data could not be read, so it will be left out of this backup.</p>
            ) : null}
            {previewFailed ? <p>{PREVIEW_FAILED}</p> : null}
          </div>
          <p className="data-hint">
            Don&apos;t save the file in a folder that syncs to the cloud. Exported files are your
            responsibility, so store this one somewhere safe.
          </p>
          <FormField id={fieldId} label="Passphrase" required error={error ?? undefined}>
            <input
              id={fieldId}
              className="form-input"
              type="password"
              autoComplete="current-password"
              value={passphrase}
              disabled={isExporting}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${fieldId}-error` : `${fieldId}-hint`}
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </FormField>
          <p id={`${fieldId}-hint`} className="data-hint">
            Use the passphrase that unlocks Crewbook. You will need it to restore this backup.
          </p>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isCsvOpen}
        onConfirm={confirmCsv}
        onCancel={() => setIsCsvOpen(false)}
        title="Download unencrypted CSV?"
        message="This file is not encrypted. It contains your team's names, roles, levels, emails and status, so anyone who gets it can read them. It leaves out all private notes and sensitive data."
        confirmLabel="Download CSV"
        variant="warning"
      />
    </>
  );
}
