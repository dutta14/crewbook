import {
  isEncryptedEnvelope,
  base64ToBytes,
  bytesToBase64,
  type EncryptedEnvelope,
} from './crypto';

// The `crewbook_` prefix is reserved for these real localStorage keys. Data properties inside the
// decrypted blob use short names (`members`, `notes`) with no prefix.
export const STORAGE_DATA_KEY = 'crewbook_data';
export const STORAGE_PRIVATE_KEY = 'crewbook_private';
export const STORAGE_SALT_KEY = 'crewbook_salt';
export const STORAGE_PRIVATE_SALT_KEY = 'crewbook_private_salt';
export const STORAGE_CHECK_KEY = 'crewbook_check';
export const CHECK_SENTINEL = 'crewbook_check';

const ALL_STORAGE_KEYS = [
  STORAGE_DATA_KEY,
  STORAGE_PRIVATE_KEY,
  STORAGE_SALT_KEY,
  STORAGE_PRIVATE_SALT_KEY,
  STORAGE_CHECK_KEY,
] as const;

export type StorageStatus = 'first-launch' | 'locked' | 'corrupted';

export class WrongPassphraseError extends Error {
  constructor() {
    super('Wrong passphrase');
    this.name = 'WrongPassphraseError';
  }
}

export class CorruptedDataError extends Error {
  constructor() {
    super('Stored data is corrupted');
    this.name = 'CorruptedDataError';
  }
}

export class CryptoUnavailableError extends Error {
  constructor() {
    super('Web Crypto is not available in this browser context');
    this.name = 'CryptoUnavailableError';
  }
}

export class StorageWriteError extends Error {
  readonly isQuotaExceeded: boolean;
  readonly isPrivate: boolean;

  constructor(isQuotaExceeded: boolean, isPrivate: boolean) {
    super(isQuotaExceeded ? 'Browser storage is full' : 'Saving to browser storage failed');
    this.name = 'StorageWriteError';
    this.isQuotaExceeded = isQuotaExceeded;
    this.isPrivate = isPrivate;
  }
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014)
  );
}

function writeRaw(key: string, value: string, isPrivate: boolean): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    throw new StorageWriteError(isQuotaError(error), isPrivate);
  }
}

export function getStorageStatus(): StorageStatus {
  const present = ALL_STORAGE_KEYS.filter((key) => readRaw(key) !== null);
  if (present.length === 0) return 'first-launch';
  const hasUnlockMaterial =
    present.includes(STORAGE_SALT_KEY) &&
    present.includes(STORAGE_PRIVATE_SALT_KEY) &&
    present.includes(STORAGE_CHECK_KEY);
  return hasUnlockMaterial ? 'locked' : 'corrupted';
}

export function readSalt(key: string): Uint8Array<ArrayBuffer> | null {
  const raw = readRaw(key);
  if (raw === null) return null;
  let salt: Uint8Array<ArrayBuffer>;
  try {
    salt = base64ToBytes(raw);
  } catch {
    throw new CorruptedDataError();
  }
  if (salt.length === 0) throw new CorruptedDataError();
  return salt;
}

export function writeSalt(key: string, salt: Uint8Array, isPrivate = false): void {
  writeRaw(key, bytesToBase64(salt), isPrivate);
}

export function readEnvelope(key: string): EncryptedEnvelope | null {
  const raw = readRaw(key);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CorruptedDataError();
  }
  if (!isEncryptedEnvelope(parsed)) throw new CorruptedDataError();
  return parsed;
}

export function writeEnvelope(key: string, envelope: EncryptedEnvelope, isPrivate = false): void {
  writeRaw(key, JSON.stringify(envelope), isPrivate);
}

export function clearAllStorage(): void {
  for (const key of [...ALL_STORAGE_KEYS, STORAGE_PRE_IMPORT_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to clear when storage is unavailable.
    }
  }
}

/*
 * Before a restore replaces everything, the current data is kept here, encrypted with the main
 * key, for a day. It is not part of getStorageStatus because an app with only this key is still a
 * first launch. There is no screen to restore from it yet; it exists so a bad import is never the
 * only copy of someone's data.
 */
export const STORAGE_PRE_IMPORT_KEY = 'crewbook-pre-import-backup';
export const PRE_IMPORT_TTL_MS = 24 * 60 * 60 * 1000;

export interface PreImportBackup {
  v: 1;
  createdAt: number;
  envelope: EncryptedEnvelope;
}

export function writePreImportBackup(envelope: EncryptedEnvelope, createdAt: number): void {
  const record: PreImportBackup = { v: 1, createdAt, envelope };
  writeRaw(STORAGE_PRE_IMPORT_KEY, JSON.stringify(record), true);
}

export function readPreImportBackup(): PreImportBackup | null {
  const raw = readRaw(STORAGE_PRE_IMPORT_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PreImportBackup> | null;
    if (
      parsed?.v === 1 &&
      typeof parsed.createdAt === 'number' &&
      isEncryptedEnvelope(parsed.envelope)
    ) {
      return { v: 1, createdAt: parsed.createdAt, envelope: parsed.envelope };
    }
  } catch {
    // An unreadable copy is treated like an old one and removed by the purge below.
  }
  return null;
}

export function clearPreImportBackup(): void {
  try {
    window.localStorage.removeItem(STORAGE_PRE_IMPORT_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

/** Removes the safety copy once it is a day old, or at once when it cannot be read. */
export function purgeExpiredPreImportBackup(now: number): void {
  if (readRaw(STORAGE_PRE_IMPORT_KEY) === null) return;
  const backup = readPreImportBackup();
  if (backup === null || now - backup.createdAt >= PRE_IMPORT_TTL_MS || backup.createdAt > now) {
    clearPreImportBackup();
  }
}
