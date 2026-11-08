import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { importMembers } from '../data/importMembers';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useToast } from '../hooks/useToast';
import type { ParsedRow } from '../types/CsvImport';
import { CSV_PARSE_ERROR, CsvParseError, parseCsv, validateCsvFile } from '../utils/csvParser';
import { CSV_TEMPLATE_FILENAME, downloadCsvTemplate } from '../utils/csvTemplate';
import '../styles/button.css';
import '../styles/csv-import.css';
import { CsvPreviewTable } from './CsvPreviewTable';
import { FileIcon } from './icons';
import { Modal } from './Modal';

export interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'preview';

// Longer than the modal's exit animation, so parsed rows leave memory soon after it closes.
const CLEAR_DELAY_MS = 250;

const pluralize = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function summary(imported: number, total: number): string {
  const skipped = total - imported;
  const base = `Imported ${imported} of ${pluralize(total, 'member')}`;
  return skipped > 0 ? `${base} (${skipped} skipped)` : base;
}

export function CsvImportModal({ isOpen, onClose }: CsvImportModalProps) {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const [wasOpen, setWasOpen] = useState(isOpen);

  const reset = () => {
    setStep('upload');
    setRows([]);
    setSelected(new Set());
    setError(null);
    setAnnouncement('');
    setIsDragging(false);
    setIsImporting(false);
  };

  // Each opening starts from the upload step.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) reset();
  }

  // Nothing parsed from the file lingers in state once the dialog has closed.
  useEffect(() => {
    if (isOpen) return undefined;
    const timer = setTimeout(reset, CLEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (step === 'preview') previewHeadingRef.current?.focus();
  }, [step]);

  const importCount = useMemo(
    () => rows.filter((row, index) => row.isValid && selected.has(index)).length,
    [rows, selected],
  );

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateCsvFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const parsed = parseCsv(await readAsText(file));
      setRows(parsed);
      setSelected(new Set(parsed.flatMap((row, index) => (row.isValid ? [index] : []))));
      setError(null);
      setStep('preview');
      setAnnouncement(
        `${file.name} selected. Step 2: Preview and import. ${pluralize(parsed.length, 'row')} found.`,
      );
    } catch (failure) {
      setError(failure instanceof CsvParseError ? failure.message : CSV_PARSE_ERROR);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    void handleFile(input.files?.[0]);
    // Lets the same file be chosen again after an error.
    input.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  };

  const handleZoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    inputRef.current?.click();
  };

  const handleTemplateClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    downloadCsvTemplate();
  };

  const toggleRow = (index: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  };

  const handleImport = async () => {
    if (importCount === 0 || isImporting) return;
    setIsImporting(true);
    try {
      const chosen = rows.filter((row, index) => row.isValid && selected.has(index));
      const result = await importMembers(chosen, storage);
      showToast(summary(result.imported, rows.length), result.imported > 0 ? 'success' : 'error');
      onClose();
    } catch {
      showToast('Import failed. Try again.', 'error');
      setIsImporting(false);
    }
  };

  const footer = (
    <>
      <button type="button" className="btn btn-secondary" onClick={onClose}>
        Cancel
      </button>
      {step === 'preview' ? (
        <button
          type="button"
          className="btn btn-primary csv-import__footer-button"
          aria-disabled={importCount === 0 || isImporting}
          onClick={() => void handleImport()}
        >
          Import{' '}
          <span key={importCount} className="count-update">
            {pluralize(importCount, 'member')}
          </span>
        </button>
      ) : null}
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import team from CSV"
      size="lg"
      footer={footer}
      mobileSheet
    >
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      {step === 'upload' ? (
        <section className="csv-import__step" aria-labelledby="csv-step-upload">
          <h3 id="csv-step-upload" className="csv-import__heading">
            Step 1: Upload file
          </h3>
          <div
            className="csv-dropzone"
            role="button"
            tabIndex={0}
            aria-label="Upload CSV file: drop a .csv file or click to browse"
            data-dragging={isDragging}
            onClick={() => inputRef.current?.click()}
            onKeyDown={handleZoneKeyDown}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsDragging(false);
              }
            }}
            onDrop={handleDrop}
          >
            <FileIcon size={32} />
            <p>Drop a .csv file or click to browse</p>
          </div>
          <p className="csv-import__hint">
            Columns: name (required), role, level, startDate (YYYY-MM-DD), email, manager, status.
            Files up to 1 MB and 500 rows.
          </p>
          {error ? (
            <p className="csv-import__error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="csv-import__actions">
            <div>
              <input
                ref={inputRef}
                id="csv-file-input"
                className="sr-only csv-import__file-input"
                type="file"
                accept=".csv"
                onChange={handleInputChange}
              />
              <label htmlFor="csv-file-input" className="csv-import__link">
                Choose a .csv file
              </label>
            </div>
            <a
              className="csv-import__link"
              href="#csv-template"
              download={CSV_TEMPLATE_FILENAME}
              onClick={handleTemplateClick}
            >
              Download CSV template
            </a>
          </div>
        </section>
      ) : (
        <section className="csv-import__step" aria-labelledby="csv-step-preview">
          <h3
            id="csv-step-preview"
            ref={previewHeadingRef}
            className="csv-import__heading"
            tabIndex={-1}
          >
            Step 2: Preview and import
          </h3>
          <p className="csv-import__hint">
            Rows with problems are skipped. Clear the box on any row you do not want to import.
          </p>
          {rows.length === 0 ? (
            <p className="csv-import__empty">No member rows found in this file.</p>
          ) : null}
          <CsvPreviewTable rows={rows} selected={selected} onToggle={toggleRow} />
        </section>
      )}
    </Modal>
  );
}
