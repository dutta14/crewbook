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
import { MANAGER_OWNER_ID, MANAGER_OWNER_NAME } from '../data/actionItems';
import { DECISION_CONTEXT_MAX_LENGTH } from '../data/decisions';
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

/** The extra fields a decision (context) or follow-up (owner, due date) is captured with. */
export interface CaptureDetails {
  context?: string;
  ownerId?: string;
  /** YYYY-MM-DD; empty for none. */
  dueDate?: string;
}

export interface CaptureOwner {
  id: string;
  name: string;
}

const DEFAULT_OWNERS: CaptureOwner[] = [{ id: MANAGER_OWNER_ID, name: MANAGER_OWNER_NAME }];

interface QuickCaptureProps {
  /** The form that is open, or null. Held by the parent so a shortcut can open it too. */
  active: CaptureRequest | null;
  onOpen: (type: CaptureType) => void;
  onClose: () => void;
  /** Rejecting keeps the form open and shows the error's message when it is a ValidationError. */
  onSubmit: (type: CaptureType, title: string, details: CaptureDetails) => Promise<void>;
  /** Who a follow-up can be assigned to. Defaults to just you. */
  owners?: CaptureOwner[];
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
  owners: CaptureOwner[];
}

function CaptureForm({ type, focusNonce, onSubmit, onCancel, owners }: CaptureFormProps) {
  const ids = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [ownerId, setOwnerId] = useState(MANAGER_OWNER_ID);
  const [dueDate, setDueDate] = useState('');
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
      await onSubmit(
        type,
        title,
        type === 'decision' ? { context } : type === 'followup' ? { ownerId, dueDate } : {},
      );
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : SAVE_FAILED);
      setIsSaving(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      // Plain Enter adds a line in the context box, so the shortcut is how it submits from there.
      event.preventDefault();
      event.currentTarget.closest('form')?.requestSubmit();
    }
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
      {type === 'decision' ? (
        <div className="inline-capture-form__extra">
          <label className="sr-only" htmlFor={`${ids}-context`}>
            Decision context
          </label>
          <textarea
            id={`${ids}-context`}
            className="form-input inline-capture-form__context"
            placeholder="Why? The reasoning behind it (optional)"
            rows={2}
            maxLength={DECISION_CONTEXT_MAX_LENGTH}
            value={context}
            onChange={(event) => setContext(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      ) : null}
      {type === 'followup' ? (
        <div className="inline-capture-form__extra">
          <label className="inline-capture-form__field" htmlFor={`${ids}-owner`}>
            Owner
            <select
              id={`${ids}-owner`}
              className="form-input"
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              onKeyDown={handleKeyDown}
            >
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-capture-form__field" htmlFor={`${ids}-due`}>
            Due date
            <input
              id={`${ids}-due`}
              type="date"
              className="form-input"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </label>
        </div>
      ) : null}
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
export function QuickCapture({
  active,
  onOpen,
  onClose,
  onSubmit,
  owners = DEFAULT_OWNERS,
  editorRef,
}: QuickCaptureProps) {
  const buttons = useRef(new Map<CaptureType, HTMLButtonElement>());

  const handleSubmit = async (type: CaptureType, title: string, details: CaptureDetails) => {
    await onSubmit(type, title, details);
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
          owners={owners}
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
