import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ACTION_ITEM_TITLE_MAX_LENGTH,
  MANAGER_OWNER_ID,
  MANAGER_OWNER_NAME,
  createActionItem,
} from '../data/actionItems';
import { ValidationError } from '../data/errors';
import { listMembers } from '../data/members';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useToast } from '../hooks/useToast';
import type { ActionItem } from '../types/ActionItem';
import '../styles/action-items.css';
import '../styles/button.css';
import '../styles/form.css';

interface ActionItemInlineProps {
  memberId: string;
  noteId?: string;
  onCreated: (item: ActionItem) => void;
  onCancel: () => void;
}

const TITLE_REQUIRED = 'Enter a title for this action item';
const SAVE_FAILED = "Couldn't save the action item. Try again.";

/** Title, owner and optional due date on one row. Enter adds the item, Escape cancels. */
export function ActionItemInline({ memberId, noteId, onCreated, onCancel }: ActionItemInlineProps) {
  const storage = useEncryptedStorage();
  const ids = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState(MANAGER_OWNER_ID);
  const [dueDate, setDueDate] = useState('');
  const [titleError, setTitleError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const members = useMemo(() => listMembers(storage), [storage]);
  const titleId = `${ids}-title`;
  const errorId = `${ids}-title-error`;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    if (title.trim().length === 0) {
      setTitleError(TITLE_REQUIRED);
      titleRef.current?.focus();
      return;
    }
    setIsSaving(true);
    setSaveError('');
    try {
      const item = await createActionItem(
        { memberId, noteId, title, ownerId, dueDate: dueDate || undefined },
        storage,
      );
      onCreated(item);
    } catch (error) {
      if (error instanceof ValidationError && error.message.startsWith('Title')) {
        setTitleError(error.message);
        titleRef.current?.focus();
      } else {
        setSaveError(error instanceof ValidationError ? error.message : SAVE_FAILED);
      }
      setIsSaving(false);
    }
  };

  // Escape from any field cancels. A native listener keeps the form a plain, non-interactive element.
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  });
  useEffect(() => {
    const form = formRef.current;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      cancelRef.current();
    };
    form?.addEventListener('keydown', handleKeyDown);
    return () => form?.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <form
      ref={formRef}
      className="action-item-inline"
      aria-label="New action item"
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="action-item-inline__row">
        <div className="form-field action-item-inline__title">
          <label className="form-label" htmlFor={titleId}>
            Title
          </label>
          <input
            ref={titleRef}
            id={titleId}
            type="text"
            className="form-input"
            autoComplete="off"
            maxLength={ACTION_ITEM_TITLE_MAX_LENGTH}
            value={title}
            aria-required="true"
            aria-invalid={titleError !== ''}
            aria-describedby={titleError ? errorId : undefined}
            onChange={(event) => {
              setTitle(event.target.value);
              setTitleError('');
            }}
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor={`${ids}-owner`}>
            Owner
          </label>
          <select
            id={`${ids}-owner`}
            className="form-input"
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
          >
            <option value={MANAGER_OWNER_ID}>{MANAGER_OWNER_NAME}</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor={`${ids}-due`}>
            Due date (optional)
          </label>
          <input
            id={`${ids}-due`}
            type="date"
            className="form-input"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>
      </div>
      {titleError ? (
        <p id={errorId} className="form-error action-item-inline__error" role="alert">
          {titleError}
        </p>
      ) : null}
      {saveError ? (
        <p className="form-error action-item-inline__error" role="alert">
          {saveError}
        </p>
      ) : null}
      <div className="action-item-inline__actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" aria-disabled={isSaving}>
          Add action item
        </button>
      </div>
    </form>
  );
}

interface AddActionItemProps {
  memberId: string;
  noteId?: string;
  onCreated?: (item: ActionItem) => void;
}

/** The "+ Action Item" button that opens the inline form and gets focus back when it closes. */
export function AddActionItem({ memberId, noteId, onCreated }: AddActionItemProps) {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (!isOpen && returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [isOpen]);

  const close = () => {
    returnFocus.current = true;
    setIsOpen(false);
  };

  return (
    <div className="add-action-item">
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-ghost"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        + Action Item
      </button>
      {isOpen ? (
        <ActionItemInline
          memberId={memberId}
          noteId={noteId}
          onCreated={(item) => {
            showToast('Action item added', 'success');
            onCreated?.(item);
            close();
          }}
          onCancel={close}
        />
      ) : null}
    </div>
  );
}
