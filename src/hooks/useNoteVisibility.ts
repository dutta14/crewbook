import { useCallback } from 'react';
import { setNoteVisibility, setVisibilityForMember } from '../data/notes';
import { getDefaultNoteVisibility } from '../data/settings';
import type { NoteVisibility } from '../types/Note';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useToast } from './useToast';

const CHANGE_FAILED = "Couldn't change who can see that note. Nothing was changed.";
const BULK_FAILED = "Couldn't change who can see these notes. Nothing was changed.";

/**
 * Changing visibility for one person's notes. The confirmation for sharing is the caller's job;
 * these functions only apply a change. They take the visibility to set, never "flip", so a double
 * click cannot undo itself. Resolves true when the change was saved.
 */
export function useNoteVisibility(engineerId: string) {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();

  const setVisibility = useCallback(
    async (noteId: string, visibility: NoteVisibility) => {
      try {
        await setNoteVisibility(noteId, visibility, storage);
        return true;
      } catch {
        showToast(CHANGE_FAILED, 'error');
        return false;
      }
    },
    [storage, showToast],
  );

  const bulkSetVisibility = useCallback(
    async (visibility: NoteVisibility) => {
      try {
        await setVisibilityForMember(engineerId, visibility, storage);
        return true;
      } catch {
        showToast(BULK_FAILED, 'error');
        return false;
      }
    },
    [engineerId, storage, showToast],
  );

  const getDefaultVisibility = useCallback(() => getDefaultNoteVisibility(storage), [storage]);

  return { setVisibility, bulkSetVisibility, getDefaultVisibility };
}
