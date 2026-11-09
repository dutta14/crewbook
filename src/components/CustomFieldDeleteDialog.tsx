import { useId, useRef } from 'react';
import type { CustomFieldDefinition } from '../types/customField';
import { Modal } from './Modal';
import { WarningIcon } from './icons';
import '../styles/custom-fields.css';

interface CustomFieldDeleteDialogProps {
  field: CustomFieldDefinition | null;
  affectedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Cancel gets the initial focus because deleting also removes every member's value. */
export function CustomFieldDeleteDialog({
  field,
  affectedCount,
  onConfirm,
  onCancel,
}: CustomFieldDeleteDialogProps) {
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const people = `${affectedCount} team ${affectedCount === 1 ? 'member' : 'members'}`;

  return (
    <Modal
      isOpen={field !== null}
      onClose={onCancel}
      title={field ? `Delete “${field.name}”?` : 'Delete field?'}
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
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            Delete Field
          </button>
        </>
      }
    >
      <p id={messageId} className="custom-field-warning">
        <WarningIcon size={20} />
        <span>
          Deleting this field will remove its value from all {people}. This cannot be undone.
        </span>
      </p>
    </Modal>
  );
}
