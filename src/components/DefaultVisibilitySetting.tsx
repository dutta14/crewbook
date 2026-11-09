import { useId } from 'react';
import { getDefaultNoteVisibility, setDefaultNoteVisibility } from '../data/settings';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useToast } from '../hooks/useToast';
import type { NoteVisibility } from '../types/Note';
import '../styles/settings.css';

const SAVE_FAILED = "Couldn't save that setting. Try again.";

const OPTIONS: readonly { value: NoteVisibility; label: string; hint: string }[] = [
  { value: 'private', label: 'Private', hint: 'Only you can see new notes until you share them.' },
  { value: 'shared', label: 'Shared', hint: 'New notes can appear in your next share link.' },
];

/** What a new note starts as. Private unless the manager chooses otherwise. */
export function DefaultVisibilitySetting() {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const name = useId();
  const current = getDefaultNoteVisibility(storage);

  const choose = async (value: NoteVisibility) => {
    try {
      await setDefaultNoteVisibility(value, storage);
    } catch {
      showToast(SAVE_FAILED, 'error');
    }
  };

  return (
    <fieldset className="settings-choice">
      <legend className="settings-row__label">Default visibility for new notes</legend>
      <p className="settings-row__description">
        Existing notes keep their setting. You can change any note afterwards.
      </p>
      <div className="settings-choice__options">
        {OPTIONS.map(({ value, label, hint }) => (
          <label key={value} className="settings-choice__option">
            <input
              type="radio"
              name={name}
              value={value}
              checked={current === value}
              onChange={() => void choose(value)}
            />
            <span className="settings-choice__label">{label}</span>
            <span className="settings-row__description">{hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
