import { render, type RenderResult } from '@testing-library/react';
import { useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  EncryptedStorageContext,
  type EncryptedStorageContextValue,
} from '../components/EncryptedStorageProvider';
import { ToastProvider } from '../components/Toast';
import type { AppData } from '../types';
import { WrongPassphraseError } from '../utils/encryptedStorage';

export interface RenderWithProvidersOptions {
  route?: string;
  // Seeds the unlocked in-memory storage double. Settings arrive with issue #3.
  initialData?: Partial<AppData>;
  // Seeds the private envelope double, which holds notes and drafts.
  initialPrivateData?: Record<string, unknown>;
  // The key getShareSigningKey returns; null (the default) behaves like a locked session.
  signingKey?: CryptoKey | null;
  // The passphrase verifyPassphrase accepts.
  passphrase?: string;
  // Makes changePassphrase reject after the current passphrase checks out, like a failed write.
  failPassphraseChange?: boolean;
}

// An always-unlocked, in-memory stand-in for EncryptedStorageProvider: no lock screen, no crypto.
function InMemoryEncryptedStorage({
  initialData,
  initialPrivateData,
  signingKey,
  passphrase,
  failPassphraseChange,
  children,
}: {
  initialData: Partial<AppData>;
  initialPrivateData: Record<string, unknown>;
  signingKey: CryptoKey | null;
  passphrase: string;
  failPassphraseChange: boolean;
  children: ReactNode;
}) {
  const [data] = useState(() => new Map<string, unknown>(Object.entries(initialData)));
  const [privateData] = useState(
    () => new Map<string, unknown>(Object.entries(initialPrivateData)),
  );
  const currentPassphrase = useRef(passphrase);
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
      getShareSigningKey: () => signingKey,
      flush: async () => null,
      verifyPassphrase: async (candidate: string) => candidate === currentPassphrase.current,
      exportSnapshot: async () => ({
        main: Object.fromEntries(data),
        private: Object.fromEntries(privateData),
      }),
      replaceAll: async (next, onProgress) => {
        data.clear();
        privateData.clear();
        Object.entries(next.main).forEach(([key, item]) => data.set(key, item));
        Object.entries(next.private ?? {}).forEach(([key, item]) => privateData.set(key, item));
        onProgress?.(1);
        setVersion((current) => current + 1);
      },
      changePassphrase: async (current, next, onProgress) => {
        if (current !== currentPassphrase.current) throw new WrongPassphraseError();
        if (failPassphraseChange) throw new Error('Re-encryption failed');
        onProgress?.(1);
        currentPassphrase.current = next;
      },
      clearAllData: async () => {
        data.clear();
        privateData.clear();
        setVersion((current) => current + 1);
      },
    }),
    // `version` gives consumers a fresh context value after each write, like the real provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, privateData, signingKey, failPassphraseChange, version],
  );

  return (
    <EncryptedStorageContext.Provider value={value}>{children}</EncryptedStorageContext.Provider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    initialData = {},
    initialPrivateData = {},
    signingKey = null,
    passphrase = 'test passphrase',
    failPassphraseChange = false,
  }: RenderWithProvidersOptions = {},
): RenderResult {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <InMemoryEncryptedStorage
          initialData={initialData}
          initialPrivateData={initialPrivateData}
          signingKey={signingKey}
          passphrase={passphrase}
          failPassphraseChange={failPassphraseChange}
        >
          {children}
        </InMemoryEncryptedStorage>
      </ToastProvider>
    </MemoryRouter>
  );
  return render(ui, { wrapper: Wrapper });
}
