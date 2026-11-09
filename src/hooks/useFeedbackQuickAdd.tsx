import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { FeedbackModal } from '../components/FeedbackModal';
import { listMembers } from '../data/members';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useFeedback } from './useFeedback';
import { useToast } from './useToast';

interface QuickAddState {
  isOpen: boolean;
  engineerId?: string;
}

/**
 * Opens the "Log feedback" dialog from anywhere. Feedback lives in the private envelope, so that
 * is opened before the dialog is shown; if it can't be, nothing opens and the user is told why.
 */
export function useFeedbackQuickAdd(): {
  openQuickAdd: (engineerId?: string) => Promise<void>;
  quickAddModal: ReactNode;
} {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const { addEntry } = useFeedback();
  const [state, setState] = useState<QuickAddState>({ isOpen: false });
  const members = useMemo(() => listMembers(storage), [storage]);
  const { loadPrivate } = storage;

  const openQuickAdd = useCallback(
    async (engineerId?: string) => {
      try {
        await loadPrivate();
      } catch {
        showToast("Couldn't open feedback. Unlock your notes and try again.", 'error');
        return;
      }
      setState({ isOpen: true, engineerId });
    },
    [loadPrivate, showToast],
  );

  const quickAddModal = (
    <FeedbackModal
      isOpen={state.isOpen}
      onClose={() => setState((current) => ({ ...current, isOpen: false }))}
      members={members}
      defaultEngineerId={state.engineerId}
      onSubmit={async (values) => {
        await addEntry(values);
        showToast('Feedback logged', 'success');
      }}
    />
  );

  return { openQuickAdd, quickAddModal };
}
