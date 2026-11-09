import { afterEach, describe, expect, it, vi } from 'vitest';
import { decryptString } from '../utils/crypto';
import { fastDeriveKey } from '../test-utils/fastCrypto';
import {
  PRE_IMPORT_TTL_MS,
  readPreImportBackup,
  STORAGE_DATA_KEY,
  STORAGE_PRE_IMPORT_KEY,
  STORAGE_PRIVATE_KEY,
  STORAGE_SALT_KEY,
  StorageWriteError,
  clearAllStorage,
} from '../utils/encryptedStorage';
import { base64ToBytes } from '../utils/crypto';
import { StorageManager } from './StorageManager';

vi.mock('../utils/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/crypto')>();
  const { fastDeriveKey: fast, fastDeriveSigningKey } = await import('../test-utils/fastCrypto');
  return { ...actual, deriveKey: fast, deriveSigningKey: fastDeriveSigningKey };
});

const PASSPHRASE = 'correct horse battery staple';

async function createUnlocked(): Promise<StorageManager> {
  const manager = new StorageManager();
  await manager.setup(PASSPHRASE);
  await manager.loadPrivate();
  return manager;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('verifyPassphrase', () => {
  it('accepts the passphrase that unlocks the storage', async () => {
    const manager = await createUnlocked();

    expect(await manager.verifyPassphrase(PASSPHRASE)).toBe(true);
  });

  it('rejects any other passphrase', async () => {
    const manager = await createUnlocked();

    expect(await manager.verifyPassphrase('something else')).toBe(false);
  });

  it('refuses to run while locked', async () => {
    const manager = await createUnlocked();
    await manager.lock();

    await expect(manager.verifyPassphrase(PASSPHRASE)).rejects.toThrow('locked');
  });
});

describe('exportSnapshot', () => {
  it('returns copies of both envelopes that later writes do not change', async () => {
    const manager = await createUnlocked();
    manager.setData('members', [{ id: 'm1' }]);
    manager.setPrivateData('moods', [{ id: 'x' }]);

    const snapshot = await manager.exportSnapshot();
    manager.setData('members', []);

    expect(snapshot.main.members).toEqual([{ id: 'm1' }]);
    expect(snapshot.private).toEqual({ moods: [{ id: 'x' }] });
  });

  it('reports the private side as null when its envelope cannot be decrypted', async () => {
    const manager = await createUnlocked();
    manager.setData('members', []);
    await manager.flush();
    await manager.lock();
    window.localStorage.setItem(
      STORAGE_PRIVATE_KEY,
      JSON.stringify({
        v: 1,
        iv: 'AAAAAAAAAAAAAAAA',
        ct: 'AAAAAAAAAAAAAAAAAAAAAA==',
        iterations: 310000,
      }),
    );
    const next = new StorageManager();
    await next.unlock(PASSPHRASE);

    const snapshot = await next.exportSnapshot();

    expect(snapshot.private).toBeNull();
    expect(snapshot.main.members).toEqual([]);
  });
});

describe('replaceAll', () => {
  it('replaces both envelopes and survives a lock and unlock', async () => {
    const manager = await createUnlocked();
    manager.setData('members', [{ id: 'old' }]);
    manager.setPrivateData('moods', [{ id: 'old-mood' }]);
    const progress = vi.fn();

    await manager.replaceAll(
      { main: { members: [{ id: 'new' }] }, private: { todos: [{ id: 't' }] } },
      progress,
    );

    expect(manager.getData('members')).toEqual([{ id: 'new' }]);
    expect(manager.getPrivateData('moods')).toBeNull();
    expect(progress.mock.calls.at(-1)).toEqual([1]);
    await manager.lock();
    const next = new StorageManager();
    await next.unlock(PASSPHRASE);
    await next.loadPrivate();
    expect(next.getData('members')).toEqual([{ id: 'new' }]);
    expect(next.getPrivateData('todos')).toEqual([{ id: 't' }]);
  });

  it('does not tell write-error listeners about its own writes', async () => {
    const manager = await createUnlocked();
    const listener = vi.fn();
    manager.onWriteError(listener);

    await manager.replaceAll({ main: {}, private: {} });

    expect(listener).not.toHaveBeenCalled();
  });

  it('empties the private envelope when the snapshot has none', async () => {
    const manager = await createUnlocked();
    manager.setPrivateData('moods', [{ id: 'old-mood' }]);

    await manager.replaceAll({ main: {}, private: null });

    expect(manager.getPrivateData('moods')).toBeNull();
  });

  it('keeps an encrypted safety copy of the previous data that the main key opens', async () => {
    const manager = await createUnlocked();
    manager.setData('members', [{ id: 'old' }]);
    manager.setPrivateData('moods', [{ id: 'old-mood' }]);

    await manager.replaceAll({ main: {}, private: {} });

    const safety = readPreImportBackup();
    expect(safety).not.toBeNull();
    const key = await fastDeriveKey(
      PASSPHRASE,
      base64ToBytes(window.localStorage.getItem(STORAGE_SALT_KEY) as string),
    );
    const restored = JSON.parse(await decryptString(safety!.envelope, key)) as {
      main: Record<string, unknown>;
      private: Record<string, unknown>;
    };
    expect(restored.main.members).toEqual([{ id: 'old' }]);
    expect(restored.private.moods).toEqual([{ id: 'old-mood' }]);
    expect(window.localStorage.getItem(STORAGE_PRE_IMPORT_KEY)).not.toContain('old-mood');
  });

  it('puts the old data back and removes the safety copy when the private write fails', async () => {
    const manager = await createUnlocked();
    manager.setData('members', [{ id: 'old' }]);
    manager.setPrivateData('moods', [{ id: 'old-mood' }]);
    await manager.flush();
    let failures = 2;
    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === STORAGE_PRIVATE_KEY && failures > 0) {
        failures -= 1;
        throw new DOMException('full', 'QuotaExceededError');
      }
      realSetItem.call(this, key, value);
    });

    await expect(
      manager.replaceAll({ main: { members: [{ id: 'new' }] }, private: { todos: [] } }),
    ).rejects.toBeInstanceOf(StorageWriteError);
    vi.restoreAllMocks();

    expect(manager.getData('members')).toEqual([{ id: 'old' }]);
    expect(manager.getPrivateData('moods')).toEqual([{ id: 'old-mood' }]);
    expect(window.localStorage.getItem(STORAGE_PRE_IMPORT_KEY)).toBeNull();
    await manager.lock();
    const next = new StorageManager();
    await next.unlock(PASSPHRASE);
    await next.loadPrivate();
    expect(next.getData('members')).toEqual([{ id: 'old' }]);
    expect(next.getPrivateData('moods')).toEqual([{ id: 'old-mood' }]);
  });

  it('fails without touching the data when the safety copy cannot be written', async () => {
    const manager = await createUnlocked();
    manager.setData('members', [{ id: 'old' }]);
    await manager.flush();
    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === STORAGE_PRE_IMPORT_KEY) throw new DOMException('full', 'QuotaExceededError');
      realSetItem.call(this, key, value);
    });

    await expect(
      manager.replaceAll({ main: { members: [{ id: 'new' }] }, private: {} }),
    ).rejects.toBeDefined();
    vi.restoreAllMocks();

    expect(manager.getData('members')).toEqual([{ id: 'old' }]);
    expect(window.localStorage.getItem(STORAGE_DATA_KEY)).not.toBeNull();
  });
});

describe('safety copy lifetime', () => {
  it('is removed on unlock once it is 24 hours old', async () => {
    const manager = await createUnlocked();
    await manager.replaceAll({ main: {}, private: {} });
    await manager.lock();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + PRE_IMPORT_TTL_MS + 1000);

    await new StorageManager().unlock(PASSPHRASE);

    expect(window.localStorage.getItem(STORAGE_PRE_IMPORT_KEY)).toBeNull();
  });

  it('is kept on unlock while it is recent', async () => {
    const manager = await createUnlocked();
    await manager.replaceAll({ main: {}, private: {} });
    await manager.lock();

    await new StorageManager().unlock(PASSPHRASE);

    expect(window.localStorage.getItem(STORAGE_PRE_IMPORT_KEY)).not.toBeNull();
  });

  it('is removed with everything else when storage is cleared', async () => {
    const manager = await createUnlocked();
    await manager.replaceAll({ main: {}, private: {} });

    clearAllStorage();

    expect(window.localStorage.getItem(STORAGE_PRE_IMPORT_KEY)).toBeNull();
  });
});
