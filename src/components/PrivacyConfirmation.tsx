import { useId, useRef } from 'react';
import '../styles/button.css';
import '../styles/flight-risk.css';
import { Modal } from './Modal';
import { WarningIcon } from './icons';

interface PrivacyConfirmationProps {
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  /** The acknowledgement the manager must accept before anything is saved. */
  message?: string;
  confirmLabel?: string;
  isBusy?: boolean;
}

/**
 * A blocking alertdialog for actions that create private records. Focus starts on Cancel, so
 * pressing Enter by accident never saves. Mount it only while it is needed.
 */
export function PrivacyConfirmation({
  onConfirm,
  onCancel,
  title = 'Save private note?',
  message = 'This is private and will never be shared',
  confirmLabel = 'Save',
  isBusy = false,
}: PrivacyConfirmationProps) {
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={title}
      size="sm"
      role="alertdialog"
      describedBy={messageId}
      closeOnBackdrop={false}
      initialFocusRef={cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={isBusy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="privacy-banner">
        <WarningIcon size={16} />
        <p id={messageId} className="privacy-banner__text">
          {message}
        </p>
      </div>
    </Modal>
  );
}
