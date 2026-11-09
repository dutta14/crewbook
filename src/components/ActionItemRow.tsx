import { useEffect, useRef, useState } from 'react';
import { MANAGER_OWNER_ID, setIncludeInShare, updateStatus } from '../data/actionItems';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useToast } from '../hooks/useToast';
import { useUndoableAction } from '../hooks/useUndoableAction';
import type { ActionItem, ActionItemStatus } from '../types/ActionItem';
import '../styles/action-items.css';
import '../styles/button.css';
import { ActionItemDue } from './ActionItemDue';

interface ActionItemRowProps {
  item: ActionItem;
  ownerName: string;
  now?: Date;
  /** Called when this row changes the item's status, so the list can keep it on screen. */
  onChanged: (id: string) => void;
}

const UPDATE_FAILED = "Couldn't update that action item. Try again.";
const SHARE_FAILED = "Couldn't change whether that action item is shared. Try again.";

export function ActionItemRow({ item, ownerName, now, onChanged }: ActionItemRowProps) {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const [announcement, setAnnouncement] = useState('');
  const checkboxRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const undoHadFocus = useRef(false);
  const { id, title, status } = item;

  // The write lands before the screen updates; a failed write rolls back and the box unticks.
  const change = async (next: ActionItemStatus) => {
    onChanged(id);
    try {
      await updateStatus(id, next, storage);
    } catch (error) {
      showToast(UPDATE_FAILED, 'error');
      throw error;
    }
  };

  const { execute, undoAvailable, triggerUndo } = useUndoableAction(
    () => change('done'),
    () => void change('open').catch(() => undefined),
  );

  // A focused Undo that disappears would drop keyboard focus onto the page body.
  useEffect(() => {
    if (undoAvailable || !undoHadFocus.current) return;
    undoHadFocus.current = false;
    if (document.activeElement === document.body) checkboxRef.current?.focus();
  }, [undoAvailable]);

  const handleToggle = () => {
    if (status === 'open') {
      setAnnouncement(`${title} marked as done. Undo available.`);
      execute();
    } else {
      setAnnouncement(`${title} reopened.`);
      void change('open').catch(() => undefined);
    }
  };

  const handleUndo = () => {
    setAnnouncement(`${title} reopened.`);
    triggerUndo();
    checkboxRef.current?.focus();
  };

  const handleCancel = () => {
    setAnnouncement(`${title} cancelled.`);
    void change('cancelled').catch(() => undefined);
  };

  const handleReopen = () => {
    setAnnouncement(`${title} reopened.`);
    void change('open').catch(() => undefined);
  };

  const isCancelled = status === 'cancelled';
  // Only the manager's items and this person's own can travel in a link, so only those get a choice.
  const canShare =
    !isCancelled && (item.ownerId === MANAGER_OWNER_ID || item.ownerId === item.memberId);
  const isShared = item.includeInShare !== false;

  const handleShareChange = (include: boolean) => {
    setIncludeInShare(id, include, storage).catch(() => showToast(SHARE_FAILED, 'error'));
  };

  return (
    <li className={`action-item action-item--${status}`}>
      {isCancelled ? (
        <span className="action-item__check-spacer" aria-hidden="true" />
      ) : (
        <label className="action-item__check">
          <input
            ref={checkboxRef}
            type="checkbox"
            className="action-item__checkbox"
            aria-label={`Mark ${title} as done`}
            checked={status === 'done'}
            onChange={handleToggle}
          />
        </label>
      )}
      <div className="action-item__body">
        <span className="action-item__title">{title}</span>
        <span className="action-item__meta">
          <span className="action-item__owner">{ownerName}</span>
          <ActionItemDue item={item} now={now} />
          {isCancelled ? <span className="action-item__state">Cancelled</span> : null}
          {canShare && !isShared ? <span className="action-item__state">Not shared</span> : null}
        </span>
      </div>
      <div className="action-item__actions">
        {undoAvailable ? (
          <button
            ref={undoRef}
            type="button"
            className="action-item__undo"
            onFocus={() => {
              undoHadFocus.current = true;
            }}
            onBlur={(event) => {
              if (event.relatedTarget) undoHadFocus.current = false;
            }}
            onClick={handleUndo}
          >
            Undo
          </button>
        ) : null}
        {canShare ? (
          <label className="action-item__share">
            <input
              type="checkbox"
              checked={isShared}
              aria-label={`Include in share link: ${title}`}
              onChange={(event) => handleShareChange(event.target.checked)}
            />
            <span>Include in share link</span>
          </label>
        ) : null}
        {status === 'open' ? (
          <button
            type="button"
            className="btn btn-ghost action-item__button"
            aria-label={`Cancel ${title}`}
            onClick={handleCancel}
          >
            Cancel
          </button>
        ) : null}
        {isCancelled ? (
          <button
            type="button"
            className="btn btn-ghost action-item__button"
            aria-label={`Reopen ${title}`}
            onClick={handleReopen}
          >
            Reopen
          </button>
        ) : null}
      </div>
      <span className="sr-only" aria-live="assertive" aria-atomic="true">
        {announcement}
      </span>
    </li>
  );
}
