import { useRef } from 'react';
import '../styles/button.css';
import { Modal } from './Modal';

interface MoodPurgePromptProps {
  isOpen: boolean;
  count: number;
  onKeep: () => void;
  onDelete: () => void;
}

/** Asked when mood tracking is switched off while ratings exist. Keeping them is the default. */
export function MoodPurgePrompt({ isOpen, count, onKeep, onDelete }: MoodPurgePromptProps) {
  const keepRef = useRef<HTMLButtonElement>(null);
  const noun = count === 1 ? 'entry' : 'entries';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onKeep}
      title="Delete saved mood entries?"
      size="sm"
      role="alertdialog"
      describedBy="mood-purge-message"
      closeOnBackdrop={false}
      initialFocusRef={keepRef}
      footer={
        <>
          <button ref={keepRef} type="button" className="btn btn-secondary" onClick={onKeep}>
            Keep entries
          </button>
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            Delete {count} {noun}
          </button>
        </>
      }
    >
      <p id="mood-purge-message" className="modal__text">
        Mood tracking is off. You have {count} saved mood {noun}. Keep them to see your charts again
        if you turn tracking back on, or delete them for good. Deleting cannot be undone.
      </p>
    </Modal>
  );
}
