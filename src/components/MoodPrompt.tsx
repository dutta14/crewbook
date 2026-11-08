import { useState } from 'react';
import { addMoodEntry, deleteMoodEntry } from '../data/moodEntries';
import { isMoodTrackingEnabled } from '../data/settings';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useToast } from '../hooks/useToast';
import type { MoodScore } from '../types/MoodEntry';
import { MoodSelector } from './MoodSelector';

interface MoodPromptProps {
  memberId: string;
  /** The note that was just saved. Ratings are never attached to older notes. */
  noteId: string;
}

const SAVE_FAILED = "Couldn't save that rating. Try again.";

/**
 * Offered once, right after a note is saved. It starts empty on purpose: showing an earlier rating
 * would anchor the next one. Each choice is written straight to the private envelope.
 */
export function MoodPrompt({ memberId, noteId }: MoodPromptProps) {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const [value, setValue] = useState<MoodScore | null>(null);

  const handleChange = (next: MoodScore | null) => {
    const previous = value;
    setValue(next);
    const write =
      next === null
        ? deleteMoodEntry(noteId, storage)
        : addMoodEntry({ memberId, noteId, score: next }, storage);
    write.catch(() => {
      setValue(previous);
      showToast(SAVE_FAILED, 'error');
    });
  };

  return (
    <MoodSelector
      value={value}
      onChange={handleChange}
      disabled={!isMoodTrackingEnabled(storage)}
    />
  );
}
