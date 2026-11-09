import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { LockScreen } from './LockScreen';

// The lock screen is the only thing rendered until unlock, so no app UI or data leaks into the DOM.
// As a layout route it renders its nested routes, so other routes can sit outside the gate.
export function LockGate({ children }: { children?: ReactNode }) {
  const { isUnlocked } = useEncryptedStorage();
  return isUnlocked ? (children ?? <Outlet />) : <LockScreen />;
}
