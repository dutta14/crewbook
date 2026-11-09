import { useState } from 'react';
import type { NoteVisibility } from '../types/Note';
import '../styles/button.css';
import '../styles/note-visibility.css';
import { EyeIcon, LockIcon } from './icons';
import { ShareNotesDialog } from './ShareNotesDialog';

interface NoteVisibilityToggleProps {
  noteId: string;
  visibility: NoteVisibility;
  engineerName: string;
  /**
   * Asks for a specific visibility rather than a flip, so repeating a click cannot undo it.
   * Called straight away for shared to private, and only after confirming for private to shared.
   */
  onToggle: (noteId: string, visibility: NoteVisibility) => unknown;
}

export function NoteVisibilityToggle({
  noteId,
  visibility,
  engineerName,
  onToggle,
}: NoteVisibilityToggleProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const isShared = visibility === 'shared';

  const handleClick = () => {
    if (isShared) void onToggle(noteId, 'private');
    else setIsConfirming(true);
  };

  const handleConfirm = () => {
    setIsConfirming(false);
    void onToggle(noteId, 'shared');
  };

  return (
    <>
      <button
        type="button"
        className={`icon-btn note-visibility note-visibility--${visibility}`}
        aria-label={`Toggle note visibility, currently ${visibility}`}
        aria-pressed={isShared}
        title={isShared ? `Shared with ${engineerName}` : 'Private — only you can see this'}
        onClick={handleClick}
      >
        {/* A plain swap: there is never a moment with both icons or neither on screen. */}
        {isShared ? <EyeIcon size={16} /> : <LockIcon size={16} />}
      </button>
      <ShareNotesDialog
        isOpen={isConfirming}
        count={1}
        engineerName={engineerName}
        onConfirm={handleConfirm}
        onCancel={() => setIsConfirming(false)}
      />
    </>
  );
}
