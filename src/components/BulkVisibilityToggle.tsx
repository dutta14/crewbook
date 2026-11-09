import { useState } from 'react';
import type { Note, NoteVisibility } from '../types/Note';
import '../styles/button.css';
import '../styles/note-visibility.css';
import { ShareNotesDialog } from './ShareNotesDialog';

interface BulkVisibilityToggleProps {
  /** Every note of this person, so the counts cover notes the list may not be showing. */
  notes: readonly Pick<Note, 'visibility'>[];
  engineerName: string;
  onSetAll: (visibility: NoteVisibility) => unknown;
}

/** Sets the whole history shared or private. Sharing asks first; going private does not. */
export function BulkVisibilityToggle({ notes, engineerName, onSetAll }: BulkVisibilityToggleProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  // Kept while the dialog closes, so the count does not change under the manager's eyes.
  const [confirmCount, setConfirmCount] = useState(0);
  const privateCount = notes.filter((note) => note.visibility !== 'shared').length;
  const sharedCount = notes.length - privateCount;

  // aria-disabled keeps focus on the button after it has done its job.
  const handleShareAll = () => {
    if (privateCount === 0) return;
    setConfirmCount(privateCount);
    setIsConfirming(true);
  };

  const handlePrivateAll = () => {
    if (sharedCount > 0) void onSetAll('private');
  };

  return (
    <div className="bulk-visibility" role="group" aria-label="Note visibility">
      <button
        type="button"
        className="btn btn-secondary bulk-visibility__button"
        aria-label="Make all shared: set all notes from this session to shared"
        aria-disabled={privateCount === 0}
        onClick={handleShareAll}
      >
        Make all shared
      </button>
      <button
        type="button"
        className="btn btn-secondary bulk-visibility__button"
        aria-label="Make all private: set all notes from this session to private"
        aria-disabled={sharedCount === 0}
        onClick={handlePrivateAll}
      >
        Make all private
      </button>
      <ShareNotesDialog
        isOpen={isConfirming}
        count={confirmCount}
        engineerName={engineerName}
        onConfirm={() => {
          setIsConfirming(false);
          void onSetAll('shared');
        }}
        onCancel={() => setIsConfirming(false)}
      />
    </div>
  );
}
