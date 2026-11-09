import { getFeedbackCount } from '../data/feedbackStore';
import { useEncryptedStorage } from './useEncryptedStorage';
import { usePrivateEnvelope } from './usePrivateEnvelope';

/** How many entries there are for one person: a number, never any content. Null until known. */
export function useFeedbackCount(engineerId: string): number | null {
  const storage = useEncryptedStorage();
  const { isReady } = usePrivateEnvelope();
  return isReady ? getFeedbackCount(storage, engineerId) : null;
}
