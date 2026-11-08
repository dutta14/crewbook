import type { ReactNode } from 'react';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { LockScreen } from './LockScreen';

// The lock screen is the only thing rendered until unlock, so no app UI or data leaks into the DOM.
export function LockGate({ children }: { children: ReactNode }) {
  const { isUnlocked } = useEncryptedStorage();
  return isUnlocked ? children : <LockScreen />;
}
