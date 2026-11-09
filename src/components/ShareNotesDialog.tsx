import { useId, useRef } from 'react';
import '../styles/button.css';
import '../styles/note-visibility.css';
import { Modal } from './Modal';
import { WarningIcon } from './icons';

interface ShareNotesDialogProps {
  isOpen: boolean;
  /** How many notes become visible. One reads as a single note. */
  count: number;
  engineerName: string;
  onConfirm: () => void;
  /** Cancel, Escape and the close button all call this. None of them shares anything. */
  onCancel: () => void;
}

/**
 * The last line of defence before a private note can reach a share link. It is a blocking
 * alertdialog: a click outside does nothing, and focus starts on Cancel so that pressing Enter
 * straight away shares nothing.
 */
export function ShareNotesDialog({
  isOpen,
  count,
  engineerName,
  onConfirm,
  onCancel,
}: ShareNotesDialogProps) {
  const warningId = useId();
  const reminderId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const isSingle = count === 1;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={isSingle ? 'Share this note?' : `Share ${count} notes?`}
      size="md"
      role="alertdialog"
      describedBy={`${warningId} ${reminderId}`}
      closeOnBackdrop={false}
      initialFocusRef={cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            {isSingle ? 'Share Note' : 'Share Notes'}
          </button>
        </>
      }
    >
      <div className="share-warning" role="alert">
        <WarningIcon size={20} />
        <p id={warningId} className="share-warning__text">
          {isSingle
            ? `This note will become visible to ${engineerName}.`
            : `${count} notes will become visible to ${engineerName}.`}
        </p>
      </div>
      <p id={reminderId} className="modal__text share-warning__reminder">
        Previously generated share links are not affected.
      </p>
    </Modal>
  );
}
