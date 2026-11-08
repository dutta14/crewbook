import { render, type RenderResult } from '@testing-library/react';
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  EncryptedStorageContext,
  type EncryptedStorageContextValue,
} from '../components/EncryptedStorageProvider';
import { ToastProvider } from '../components/Toast';
import type { AppData } from '../types';

export interface RenderWithProvidersOptions {
  route?: string;
  // Seeds the unlocked in-memory storage double. Settings arrive with issue #3.
  initialData?: Partial<AppData>;
}

// An always-unlocked, in-memory stand-in for EncryptedStorageProvider: no lock screen, no crypto.
function InMemoryEncryptedStorage({
  initialData,
  children,
}: {
  initialData: Partial<AppData>;
  children: ReactNode;
}) {
  const [data] = useState(() => new Map<string, unknown>(Object.entries(initialData)));
  const [privateData] = useState(() => new Map<string, unknown>());
  const [version, setVersion] = useState(0);

  const value = useMemo<EncryptedStorageContextValue>(
    () => ({
      isUnlocked: true,
      isFirstLaunch: false,
      isCorrupted: false,
      isCryptoSupported: true,
      isPrivateUnlocked: true,
      unlock: async () => true,
      setup: async () => undefined,
      lock: () => undefined,
      reset: () => undefined,
      get: <T,>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
      set: <T,>(key: string, next: T) => {
        data.set(key, next);
        setVersion((current) => current + 1);
      },
      loadPrivate: async () => undefined,
      getPrivate: <T,>(key: string) => (privateData.has(key) ? (privateData.get(key) as T) : null),
      setPrivate: <T,>(key: string, next: T) => {
        privateData.set(key, next);
        setVersion((current) => current + 1);
      },
      flush: async () => undefined,
    }),
    // `version` gives consumers a fresh context value after each write, like the real provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, privateData, version],
  );

  return (
    <EncryptedStorageContext.Provider value={value}>{children}</EncryptedStorageContext.Provider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', initialData = {} }: RenderWithProvidersOptions = {},
): RenderResult {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <InMemoryEncryptedStorage initialData={initialData}>{children}</InMemoryEncryptedStorage>
      </ToastProvider>
    </MemoryRouter>
  );
  return render(ui, { wrapper: Wrapper });
}
