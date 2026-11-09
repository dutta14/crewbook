import { useCallback, useMemo } from 'react';
import {
  createDocumentLink,
  deleteDocumentLink,
  getDocumentLinks,
  updateDocumentLink,
  type DocumentLinkUpdate,
} from '../data/documentLinksStore';
import { ValidationError } from '../data/errors';
import type { DocumentLink, DocumentLinkInput } from '../types/document';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useToast } from './useToast';

const SAVE_FAILED = "Couldn't save that link. Try again.";
const DELETE_FAILED = "Couldn't remove that link. Try again.";

export interface UseDocumentLinks {
  links: DocumentLink[];
  /**
   * Every write waits for the encrypted store, so the screen only changes once it has landed.
   * A failed write rolls back and shows an error toast, then rejects so the caller can stand
   * down. A ValidationError rejects without a toast; the form reports it next to the field.
   * Needs the private envelope to be open; see usePrivateEnvelope.
   */
  addLink: (link: DocumentLinkInput) => Promise<void>;
  editLink: (id: string, updates: DocumentLinkUpdate) => Promise<void>;
  removeLink: (id: string) => Promise<void>;
}

export function useDocumentLinks(memberId: string): UseDocumentLinks {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();

  const links = useMemo(() => getDocumentLinks(storage, memberId), [storage, memberId]);

  const run = useCallback(
    async (operation: () => Promise<unknown>, failure: string) => {
      try {
        await operation();
      } catch (error) {
        if (!(error instanceof ValidationError)) showToast(failure, 'error');
        throw error;
      }
    },
    [showToast],
  );

  const addLink = useCallback(
    (link: DocumentLinkInput) =>
      run(() => createDocumentLink(memberId, link, storage), SAVE_FAILED),
    [run, memberId, storage],
  );
  const editLink = useCallback(
    (id: string, updates: DocumentLinkUpdate) =>
      run(() => updateDocumentLink(id, updates, storage), SAVE_FAILED),
    [run, storage],
  );
  const removeLink = useCallback(
    (id: string) => run(() => deleteDocumentLink(id, storage), DELETE_FAILED),
    [run, storage],
  );

  return { links, addLink, editLink, removeLink };
}
