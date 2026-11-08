import { useCallback } from 'react';
import { toggleFollowUpStatus } from '../data/decisions';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useToast } from './useToast';

const UPDATE_FAILED = "Couldn't update that follow-up. Try again.";

/**
 * Flips a follow-up through the encrypted store; the screen only changes once that write has
 * landed. A failed write rolls back, shows an error toast and rejects so the caller can stand down.
 */
export function useFollowUpStatusChange(): (id: string) => Promise<void> {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  return useCallback(
    async (id: string) => {
      try {
        await toggleFollowUpStatus(id, storage);
      } catch (error) {
        showToast(UPDATE_FAILED, 'error');
        throw error;
      }
    },
    [storage, showToast],
  );
}
