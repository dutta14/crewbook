import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../styles/data-management.css';
import './Modal.css';

interface EncryptionProgressModalProps {
  isOpen: boolean;
  /** 0 to 1. */
  progress: number;
}

/**
 * Blocks the page while data is re-encrypted. It has no close button and ignores Escape and
 * backdrop clicks, because leaving halfway would be worse than waiting a few seconds.
 */
export function EncryptionProgressModal({ isOpen, progress }: EncryptionProgressModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    // Focus has nowhere else to go, and leaving halfway is not allowed.
    const blockKeys = (event: KeyboardEvent) => {
      if (event.key === 'Tab' || event.key === 'Escape') event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    document.addEventListener('keydown', blockKeys);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeLeaving);
      document.removeEventListener('keydown', blockKeys);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;
  const percent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);

  return createPortal(
    <div className="modal-backdrop" data-state="open" role="presentation">
      <div
        ref={dialogRef}
        className="modal modal--sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal__header">
          <h2 id={titleId} className="modal__title">
            Updating encryption — do not close this tab
          </h2>
        </div>
        <div className="modal__body">
          <progress
            className="data-progress"
            value={percent}
            max={100}
            aria-label="Re-encryption progress"
          />
          <p className="data-hint" role="status">
            {percent}% complete
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
