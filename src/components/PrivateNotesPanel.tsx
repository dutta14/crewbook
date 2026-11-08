import { useEffect, useRef, useState } from 'react';
import { ValidationError } from '../data/errors';
import { usePrivateEnvelope } from '../hooks/usePrivateEnvelope';
import { usePrivateNotes } from '../hooks/usePrivateNotes';
import type { FlightRiskLevel } from '../types/flightRisk';
import '../styles/button.css';
import '../styles/flight-risk.css';
import { EmptyState } from './EmptyState';
import { LockIcon } from './icons';
import { PrivacyConfirmation } from './PrivacyConfirmation';
import { PrivateNoteForm } from './PrivateNoteForm';
import { PrivateNoteItem } from './PrivateNoteItem';

interface PrivateNotesPanelProps {
  engineerId: string;
}

interface Draft {
  text: string;
  flightRisk: FlightRiskLevel;
}

const LOAD_FAILED = "Couldn't open your private notes. Lock and unlock Crewbook to try again.";

/**
 * The decrypted notes and the draft live only while this panel is mounted. Collapsing the section
 * unmounts it, which drops the draft and every note from the screen.
 */
export function PrivateNotesPanel({ engineerId }: PrivateNotesPanelProps) {
  const { isReady, loadFailed } = usePrivateEnvelope();
  const { notes, addNote } = usePrivateNotes(engineerId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pending, setPending] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (savedCount > 0) addButtonRef.current?.focus();
  }, [savedCount]);

  if (loadFailed) return <p className="private-notes__status">{LOAD_FAILED}</p>;
  if (!isReady) {
    return (
      <p className="private-notes__status" role="status">
        Opening private notes…
      </p>
    );
  }

  const confirmSave = async () => {
    if (!pending || isSaving) return;
    setIsSaving(true);
    try {
      await addNote(pending.text, pending.flightRisk);
      setPending(null);
      setIsFormOpen(false);
      setFormError('');
      setSavedCount((count) => count + 1);
    } catch (error) {
      // The draft stays in the form so nothing typed is lost; a toast already explained a write failure.
      setPending(null);
      if (error instanceof ValidationError) setFormError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openForm = () => {
    setFormError('');
    setIsFormOpen(true);
  };

  return (
    <div className="private-notes__panel">
      {isFormOpen ? (
        <PrivateNoteForm
          error={formError}
          isBusy={isSaving}
          onSubmit={(text, flightRisk) => {
            setFormError('');
            setPending({ text, flightRisk });
          }}
          onCancel={() => {
            setFormError('');
            setIsFormOpen(false);
          }}
        />
      ) : notes.length > 0 ? (
        <div className="private-notes__bar">
          <button ref={addButtonRef} type="button" className="btn btn-secondary" onClick={openForm}>
            Add Note
          </button>
        </div>
      ) : (
        <EmptyState
          icon={<LockIcon size={48} />}
          title="No private notes yet"
          headingLevel={2}
          action={{ label: 'Add first note', onClick: openForm }}
        />
      )}
      {notes.length > 0 ? (
        <ol className="private-notes__list" aria-label="Private notes">
          {notes.map((note) => (
            <PrivateNoteItem key={note.id} note={note} />
          ))}
        </ol>
      ) : null}
      {pending ? (
        <PrivacyConfirmation
          isBusy={isSaving}
          onConfirm={() => {
            void confirmSave();
          }}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </div>
  );
}
