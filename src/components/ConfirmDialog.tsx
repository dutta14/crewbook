import { useId, useRef } from 'react';
import '../styles/button.css';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
}: ConfirmDialogProps) {
  const messageId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      role="alertdialog"
      describedBy={messageId}
      closeOnBackdrop={false}
      initialFocusRef={confirmRef}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn btn-${variant}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p id={messageId} className="modal__text">
        {message}
      </p>
    </Modal>
  );
}
