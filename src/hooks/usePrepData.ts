import { useEffect, useMemo } from 'react';
import { listByMember } from '../data/actionItems';
import { getMember } from '../data/members';
import { listNotes } from '../data/notes';
import type { PrepData } from '../types/prep';
import { buildPrepData } from '../utils/prepData';
import { useEncryptedStorage } from './useEncryptedStorage';

/** Null while the private notes are loading, when there is no earlier 1:1, or if anything fails. */
export function usePrepData(engineerId: string): PrepData | null {
  const storage = useEncryptedStorage();
  const { isPrivateUnlocked, loadPrivate } = storage;

  useEffect(() => {
    if (!isPrivateUnlocked) loadPrivate().catch(() => undefined);
  }, [isPrivateUnlocked, loadPrivate]);

  // `storage` is a new value after every write, so this follows edits made while it is on screen.
  return useMemo(() => {
    if (!isPrivateUnlocked) return null;
    try {
      const member = getMember(engineerId, storage);
      if (!member) return null;
      return buildPrepData({
        member,
        notes: listNotes(engineerId, storage),
        openActionItems: listByMember(engineerId, storage, 'open'),
        now: new Date(),
      });
    } catch {
      return null;
    }
  }, [engineerId, isPrivateUnlocked, storage]);
}
