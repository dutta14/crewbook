import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { ValidationError } from '../data/errors';
import type { CaptureType } from '../types/LiveSession';
import { CAPTURE_LABELS, CAPTURE_TITLE_MAX_LENGTH } from '../utils/liveCapture';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/pages/quick-capture.css';
import { ArrowRightIcon, CheckCircleIcon, GavelIcon } from './icons';

/** `nonce` changes each time a form is asked for, so asking again moves focus back to it. */
export interface CaptureRequest {
  type: CaptureType;
  nonce: number;
}

interface QuickCaptureProps {
  /** The form that is open, or null. Held by the parent so a shortcut can open it too. */
  active: CaptureRequest | null;
  onOpen: (type: CaptureType) => void;
  onClose: () => void;
  /** Rejecting keeps the form open and shows the error's message when it is a ValidationError. */
  onSubmit: (type: CaptureType, title: string) => Promise<void>;
  /** Gets focus back after an item is added, so typing can carry on. */
  editorRef?: RefObject<HTMLTextAreaElement | null>;
}

const BUTTONS: Array<{ type: CaptureType; label: string; ariaLabel: string; icon: ReactNode }> = [
  {
    type: 'action',
    label: '+Action Item',
    ariaLabel: 'Add action item',
    icon: <CheckCircleIcon size={16} />,
  },
  {
    type: 'decision',
    label: '+Decision',
    ariaLabel: 'Add decision',
    icon: <GavelIcon size={16} />,
  },
  {
    type: 'followup',
    label: '+Follow-up',
    ariaLabel: 'Add follow-up',
    icon: <ArrowRightIcon size={16} />,
  },
];

const SAVE_FAILED = "Couldn't add that. Try again.";

interface CaptureFormProps {
  type: CaptureType;
  focusNonce: number;
  onSubmit: QuickCaptureProps['onSubmit'];
  onCancel: () => void;
}

function CaptureForm({ type, focusNonce, onSubmit, onCancel }: CaptureFormProps) {
  const ids = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const label = CAPTURE_LABELS[type];

  useEffect(() => {
    inputRef.current?.focus();
  }, [focusNonce]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    if (title.trim().length === 0) {
      setError(`Enter a title for this ${label.toLowerCase()}`);
      inputRef.current?.focus();
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit(type, title);
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : SAVE_FAILED);
      setIsSaving(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onCancel();
  };

  return (
    <form
      className="inline-capture-form"
      aria-label={`New ${label.toLowerCase()}`}
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      <label className="sr-only" htmlFor={`${ids}-title`}>
        {label} title
      </label>
      <input
        ref={inputRef}
        id={`${ids}-title`}
        type="text"
        className="form-input inline-capture-form__input"
        placeholder={`${label} title, then Enter`}
        autoComplete="off"
        maxLength={CAPTURE_TITLE_MAX_LENGTH}
        value={title}
        aria-invalid={error !== ''}
        aria-describedby={error ? `${ids}-error` : undefined}
        onChange={(event) => {
          setTitle(event.target.value);
          setError('');
        }}
        onKeyDown={handleKeyDown}
      />
      <button type="submit" className="btn btn-primary" aria-disabled={isSaving}>
        Add
      </button>
      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        Cancel
      </button>
      {error ? (
        <p id={`${ids}-error`} className="form-error inline-capture-form__error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** The +Action Item / +Decision / +Follow-up toolbar, with its inline title form above it. */
export function QuickCapture({ active, onOpen, onClose, onSubmit, editorRef }: QuickCaptureProps) {
  const buttons = useRef(new Map<CaptureType, HTMLButtonElement>());

  const handleSubmit = async (type: CaptureType, title: string) => {
    await onSubmit(type, title);
    onClose();
    editorRef?.current?.focus();
  };

  const handleCancel = () => {
    const type = active?.type;
    onClose();
    if (type) buttons.current.get(type)?.focus();
  };

  return (
    <div className="quick-capture">
      {active ? (
        <CaptureForm
          key={active.type}
          type={active.type}
          focusNonce={active.nonce}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      ) : null}
      <div className="quick-capture__toolbar">
        {BUTTONS.map(({ type, label, ariaLabel, icon }) => (
          <button
            key={type}
            ref={(node) => {
              if (node) buttons.current.set(type, node);
              else buttons.current.delete(type);
            }}
            type="button"
            className="quick-capture__btn"
            aria-label={ariaLabel}
            aria-expanded={active?.type === type}
            onClick={() => onOpen(type)}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
