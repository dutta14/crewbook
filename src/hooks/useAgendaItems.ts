import { useCallback, useEffect, useMemo } from 'react';
import {
  addAgendaItem,
  deleteAgendaItem,
  listAgendaForMember,
  setAgendaDiscussed,
  setAgendaIncludeInShare,
} from '../data/agenda';
import { ValidationError } from '../data/errors';
import type { AgendaItem } from '../types/agenda';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useToast } from './useToast';

const SAVE_FAILED = "Couldn't save that agenda item. Try again.";
const UPDATE_FAILED = "Couldn't update that agenda item. Try again.";
const DELETE_FAILED = "Couldn't remove that agenda item. Try again.";

export interface UseAgendaItems {
  /** Oldest first. Empty until the private notes have loaded. */
  items: AgendaItem[];
  /**
   * Writes wait for the encrypted store, so the screen changes once they have landed. A failed
   * write shows an error toast and rejects. A ValidationError rejects without a toast; the form
   * reports it next to the field.
   */
  addItem: (text: string, addedBy: AgendaItem['addedBy']) => Promise<AgendaItem>;
  deleteItem: (id: string) => Promise<void>;
  toggleDiscussed: (id: string) => Promise<void>;
  setIncludeInShare: (id: string, include: boolean) => Promise<void>;
}

/** The manager's side of the agenda: add, remove, tick off in live mode and choose what is shared. */
export function useAgendaItems(memberId: string): UseAgendaItems {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const { isPrivateUnlocked, loadPrivate } = storage;

  useEffect(() => {
    if (!isPrivateUnlocked) loadPrivate().catch(() => undefined);
  }, [isPrivateUnlocked, loadPrivate]);

  // `storage` is a new value after every write, so this follows edits made elsewhere on screen.
  const items = useMemo(
    () => (isPrivateUnlocked ? listAgendaForMember(memberId, storage) : []),
    [memberId, isPrivateUnlocked, storage],
  );

  const run = useCallback(
    async <T>(operation: () => Promise<T>, failure: string): Promise<T> => {
      try {
        return await operation();
      } catch (error) {
        if (!(error instanceof ValidationError)) showToast(failure, 'error');
        throw error;
      }
    },
    [showToast],
  );

  const addItem = useCallback(
    (text: string, addedBy: AgendaItem['addedBy']) =>
      run(() => addAgendaItem({ memberId, text, addedBy }, storage), SAVE_FAILED),
    [memberId, run, storage],
  );

  const deleteItem = useCallback(
    (id: string) => run(() => deleteAgendaItem(id, storage), DELETE_FAILED),
    [run, storage],
  );

  const toggleDiscussed = useCallback(
    async (id: string) => {
      const current = items.find((item) => item.id === id);
      if (!current) return;
      await run(() => setAgendaDiscussed(id, !current.discussed, storage), UPDATE_FAILED);
    },
    [items, run, storage],
  );

  const setIncludeInShare = useCallback(
    async (id: string, include: boolean) => {
      await run(() => setAgendaIncludeInShare(id, include, storage), UPDATE_FAILED);
    },
    [run, storage],
  );

  return { items, addItem, deleteItem, toggleDiscussed, setIncludeInShare };
}
