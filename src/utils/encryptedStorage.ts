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
  for (const key of ALL_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to clear when storage is unavailable.
    }
  }
}
