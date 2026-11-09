import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearPrepDismissal } from '../data/prepDismissal';
import { StorageManager } from '../data/StorageManager';
import { useToast } from '../hooks/useToast';
import type { DataSnapshot } from '../utils/backupSchema';
import { isCryptoAvailable } from '../utils/crypto';
import {
  clearAllStorage,
  CorruptedDataError,
  getStorageStatus,
  WrongPassphraseError,
  type StorageWriteError,
  type StorageStatus,
} from '../utils/encryptedStorage';

export interface EncryptedStorageContextValue {
  isUnlocked: boolean;
  isFirstLaunch: boolean;
  /** Unlock material is missing or damaged; the only way forward is to erase and start over. */
  isCorrupted: boolean;
  isCryptoSupported: boolean;
  isPrivateUnlocked: boolean;
  /** Resolves false for a wrong passphrase or unreadable data; the UI shows one generic message. */
  unlock: (passphrase: string) => Promise<boolean>;
  setup: (passphrase: string) => Promise<void>;
  lock: () => void;
  /** Erases every Crewbook key from localStorage. Only valid while locked. */
  reset: () => void;
  get: <T>(key: string) => T | null;
  /** Updates memory now and persists after a short debounce; use flush() to force the write. */
  set: <T>(key: string, value: T) => void;
  loadPrivate: () => Promise<void>;
  getPrivate: <T>(key: string) => T | null;
  setPrivate: <T>(key: string, value: T) => void;
  /** HMAC key for signing share links, derived from the passphrase. Null while locked. */
  getShareSigningKey: () => CryptoKey | null;
  /** Resolves with the failure when a write did not land, or null when everything is saved. */
  flush: () => Promise<StorageWriteError | null>;
  /** True when `passphrase` is the one that unlocks this browser's data. */
  verifyPassphrase: (passphrase: string) => Promise<boolean>;
  /** A deep copy of both envelopes for building a backup; `private` is null if it cannot be read. */
  exportSnapshot: () => Promise<DataSnapshot>;
  /** Replaces all data at once, keeping a 24-hour safety copy. Rejects with the old data intact. */
  replaceAll: (next: DataSnapshot, onProgress?: (fraction: number) => void) => Promise<void>;
  /**
   * Re-encrypts all data under a new passphrase. Rejects with WrongPassphraseError for a wrong
   * current passphrase; on any other failure the old passphrase keeps working.
   */
  changePassphrase: (
    current: string,
    next: string,
    onProgress?: (fraction: number) => void,
  ) => Promise<void>;
  /** Empties both envelopes, share links included. Stays unlocked with the same passphrase. */
  clearAllData: () => Promise<void>;
}

export const EncryptedStorageContext = createContext<EncryptedStorageContextValue | null>(null);

const CORRUPTED_DATA_MESSAGE = "Your saved data couldn't be read, so Crewbook started empty.";

function describeWriteFailure(isQuotaExceeded: boolean, isPrivate: boolean): string {
  if (isQuotaExceeded) return "Browser storage is full. Your latest changes weren't saved.";
  return isPrivate
    ? "Couldn't save your private notes. Try again."
    : "Couldn't save your changes. Try again.";
}

export function EncryptedStorageProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [manager] = useState(() => new StorageManager());
  const [isCryptoSupported] = useState(isCryptoAvailable);
  const [status, setStatus] = useState<StorageStatus>(getStorageStatus);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isPrivateUnlocked, setIsPrivateUnlocked] = useState(false);
  // Bumped on every write so consumers re-render; the data itself lives in the manager.
  const [version, setVersion] = useState(0);

  useEffect(
    () =>
      manager.onWriteError((error) =>
        showToast(describeWriteFailure(error.isQuotaExceeded, error.isPrivate), 'error'),
      ),
    [manager, showToast],
  );

  // Locking, or reloading the page, starts a new session, so the prep card comes back.
  useEffect(() => clearPrepDismissal(), []);

  useEffect(() => {
    // Best effort: encryption is async, so a write started here may not finish before unload.
    const flushOnUnload = () => void manager.flush();
    window.addEventListener('beforeunload', flushOnUnload);
    return () => window.removeEventListener('beforeunload', flushOnUnload);
  }, [manager]);

  const unlock = useCallback(
    async (passphrase: string) => {
      try {
        await manager.unlock(passphrase);
      } catch (error) {
        if (error instanceof WrongPassphraseError || error instanceof CorruptedDataError) {
          return false;
        }
        throw error;
      }
      setIsUnlocked(true);
      if (manager.didRecoverFromCorruption) showToast(CORRUPTED_DATA_MESSAGE, 'error');
      return true;
    },
    [manager, showToast],
  );

  const setup = useCallback(
    async (passphrase: string) => {
      await manager.setup(passphrase);
      setStatus('locked');
      setIsUnlocked(true);
    },
    [manager],
  );

  const lock = useCallback(() => {
    setIsUnlocked(false);
    setIsPrivateUnlocked(false);
    clearPrepDismissal();
    void manager.lock();
  }, [manager]);

  const reset = useCallback(() => {
    clearAllStorage();
    setStatus(getStorageStatus());
  }, []);

  const get = useCallback(
    <T,>(key: string) => (manager.isUnlocked ? manager.getData<T>(key) : null),
    [manager],
  );

  const set = useCallback(
    <T,>(key: string, value: T) => {
      manager.setData(key, value);
      setVersion((current) => current + 1);
    },
    [manager],
  );

  const loadPrivate = useCallback(async () => {
    await manager.loadPrivate();
    setIsPrivateUnlocked(true);
  }, [manager]);

  const getPrivate = useCallback(
    <T,>(key: string) => (manager.isPrivateUnlocked ? manager.getPrivateData<T>(key) : null),
    [manager],
  );

  const setPrivate = useCallback(
    <T,>(key: string, value: T) => {
      manager.setPrivateData(key, value);
      setVersion((current) => current + 1);
    },
    [manager],
  );

  const getShareSigningKey = useCallback(() => manager.shareSigningKey, [manager]);

  const flush = useCallback(() => manager.flush(), [manager]);

  const verifyPassphrase = useCallback(
    (passphrase: string) => manager.verifyPassphrase(passphrase),
    [manager],
  );

  const exportSnapshot = useCallback(() => manager.exportSnapshot(), [manager]);

  const replaceAll = useCallback(
    async (next: DataSnapshot, onProgress?: (fraction: number) => void) => {
      await manager.replaceAll(next, onProgress);
      setIsPrivateUnlocked(true);
      setVersion((current) => current + 1);
    },
    [manager],
  );

  const changePassphrase = useCallback(
    async (current: string, next: string, onProgress?: (fraction: number) => void) => {
      await manager.changePassphrase(current, next, onProgress);
      setVersion((value) => value + 1);
    },
    [manager],
  );

  const clearAllData = useCallback(async () => {
    await manager.clearAllData();
    setIsPrivateUnlocked(true);
    setVersion((value) => value + 1);
  }, [manager]);

  const value = useMemo<EncryptedStorageContextValue>(
    () => ({
      isUnlocked,
      isFirstLaunch: status === 'first-launch',
      isCorrupted: status === 'corrupted',
      isCryptoSupported,
      isPrivateUnlocked,
      unlock,
      setup,
      lock,
      reset,
      get,
      set,
      loadPrivate,
      getPrivate,
      setPrivate,
      getShareSigningKey,
      flush,
      verifyPassphrase,
      exportSnapshot,
      replaceAll,
      changePassphrase,
      clearAllData,
    }),
    // `version` is intentional: it gives consumers a new context value after each write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      version,
      isUnlocked,
      status,
      isCryptoSupported,
      isPrivateUnlocked,
      unlock,
      setup,
      lock,
      reset,
      get,
      set,
      loadPrivate,
      getPrivate,
      setPrivate,
      getShareSigningKey,
      flush,
      verifyPassphrase,
      exportSnapshot,
      replaceAll,
      changePassphrase,
      clearAllData,
    ],
  );

  return (
    <EncryptedStorageContext.Provider value={value}>{children}</EncryptedStorageContext.Provider>
  );
}
