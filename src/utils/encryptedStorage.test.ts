import { afterEach, describe, expect, it, vi } from 'vitest';
import { PBKDF2_ITERATIONS } from './crypto';
import {
  clearAllStorage,
  CorruptedDataError,
  getStorageStatus,
  readEnvelope,
  readSalt,
  STORAGE_CHECK_KEY,
  STORAGE_DATA_KEY,
  STORAGE_PRIVATE_SALT_KEY,
  STORAGE_SALT_KEY,
  StorageWriteError,
  writeEnvelope,
  writeSalt,
} from './encryptedStorage';

const envelope = { v: 1 as const, iv: 'AAAA', ct: 'BBBB', iterations: PBKDF2_ITERATIONS };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getStorageStatus', () => {
  it('is first-launch when no Crewbook key exists', () => {
    window.localStorage.setItem('theme', 'dark');

    expect(getStorageStatus()).toBe('first-launch');
  });

  it('is locked when both salts and the check sentinel exist', () => {
    writeSalt(STORAGE_SALT_KEY, new Uint8Array([1]));
    writeSalt(STORAGE_PRIVATE_SALT_KEY, new Uint8Array([2]));
    writeEnvelope(STORAGE_CHECK_KEY, envelope);

    expect(getStorageStatus()).toBe('locked');
  });

  it('is corrupted when data exists but the salt is missing', () => {
    writeEnvelope(STORAGE_DATA_KEY, envelope);

    expect(getStorageStatus()).toBe('corrupted');
  });

  it('is corrupted when the private salt is missing', () => {
    writeSalt(STORAGE_SALT_KEY, new Uint8Array([1]));
    writeEnvelope(STORAGE_CHECK_KEY, envelope);

    expect(getStorageStatus()).toBe('corrupted');
  });
});

describe('readEnvelope', () => {
  it('returns null when the key is absent', () => {
    expect(readEnvelope(STORAGE_DATA_KEY)).toBeNull();
  });

  it('returns a stored envelope', () => {
    writeEnvelope(STORAGE_DATA_KEY, envelope);

    expect(readEnvelope(STORAGE_DATA_KEY)).toEqual(envelope);
  });

  it.each([
    ['invalid JSON', '{oops'],
    ['the wrong shape', '{"v":1,"iv":"AAAA"}'],
    ['iterations below the minimum', JSON.stringify({ ...envelope, iterations: 1000 })],
  ])('throws CorruptedDataError for %s', (_label, raw) => {
    window.localStorage.setItem(STORAGE_DATA_KEY, raw);

    expect(() => readEnvelope(STORAGE_DATA_KEY)).toThrow(CorruptedDataError);
  });
});

describe('readSalt', () => {
  it('round-trips a salt', () => {
    writeSalt(STORAGE_SALT_KEY, new Uint8Array([1, 2, 3]));

    expect(Array.from(readSalt(STORAGE_SALT_KEY) as Uint8Array)).toEqual([1, 2, 3]);
  });

  it('returns null when absent', () => {
    expect(readSalt(STORAGE_SALT_KEY)).toBeNull();
  });

  it.each([
    ['not base64', '***'],
    ['empty', ''],
  ])('throws CorruptedDataError when %s', (_l, raw) => {
    window.localStorage.setItem(STORAGE_SALT_KEY, raw);

    expect(() => readSalt(STORAGE_SALT_KEY)).toThrow(CorruptedDataError);
  });
});

describe('writes', () => {
  it('maps a quota error to a StorageWriteError flagged as quota exceeded', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(() => writeEnvelope(STORAGE_DATA_KEY, envelope)).toThrow(
      expect.objectContaining({ isQuotaExceeded: true, isPrivate: false }),
    );
  });

  it('maps any other storage failure to a non-quota StorageWriteError', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(() => writeEnvelope(STORAGE_DATA_KEY, envelope, true)).toThrow(StorageWriteError);
  });
});

describe('clearAllStorage', () => {
  it('removes every Crewbook key and leaves unrelated keys alone', () => {
    writeEnvelope(STORAGE_DATA_KEY, envelope);
    writeSalt(STORAGE_SALT_KEY, new Uint8Array([1]));
    window.localStorage.setItem('theme', 'dark');

    clearAllStorage();

    expect(window.localStorage.getItem(STORAGE_DATA_KEY)).toBeNull();
    expect(window.localStorage.getItem(STORAGE_SALT_KEY)).toBeNull();
    expect(window.localStorage.getItem('theme')).toBe('dark');
  });
});
