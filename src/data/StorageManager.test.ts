import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fastDeriveKey } from '../test-utils/fastCrypto';
import { base64ToBytes, decryptString, encryptString } from '../utils/crypto';
import {
  CorruptedDataError,
  getStorageStatus,
  STORAGE_CHECK_KEY,
  STORAGE_DATA_KEY,
  STORAGE_PRIVATE_KEY,
  STORAGE_PRIVATE_SALT_KEY,
  STORAGE_SALT_KEY,
  StorageWriteError,
  WrongPassphraseError,
  writeEnvelope,
} from '../utils/encryptedStorage';
import { StorageManager, WRITE_DEBOUNCE_MS } from './StorageManager';

vi.mock('../utils/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/crypto')>();
  const { fastDeriveKey: fast } = await import('../test-utils/fastCrypto');
  return { ...actual, deriveKey: fast };
});

const PASSPHRASE = 'correct horse battery staple';

async function createUnlocked(): Promise<StorageManager> {
  const manager = new StorageManager();
  await manager.setup(PASSPHRASE);
  return manager;
}

async function relock(manager: StorageManager): Promise<StorageManager> {
  await manager.lock();
  const next = new StorageManager();
  await next.unlock(PASSPHRASE);
  return next;
}

const stored = (key: string) => window.localStorage.getItem(key);

async function keyFor(saltKey: string, passphrase = PASSPHRASE) {
  return fastDeriveKey(passphrase, base64ToBytes(stored(saltKey) as string));
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('setup', () => {
  it('reports first launch before anything is stored', () => {
    expect(getStorageStatus()).toBe('first-launch');
  });

  it('creates the two envelopes, two salts and the check sentinel, then unlocks', async () => {
    const manager = await createUnlocked();

    for (const key of [
      STORAGE_DATA_KEY,
      STORAGE_PRIVATE_KEY,
      STORAGE_CHECK_KEY,
      STORAGE_SALT_KEY,
      STORAGE_PRIVATE_SALT_KEY,
    ]) {
      expect(stored(key)).not.toBeNull();
    }
    expect(manager.isUnlocked).toBe(true);
    expect(getStorageStatus()).toBe('locked');
  });

  it('uses a different 16-byte salt for each envelope', async () => {
    await createUnlocked();

    const mainSalt = base64ToBytes(stored(STORAGE_SALT_KEY) as string);
    const privateSalt = base64ToBytes(stored(STORAGE_PRIVATE_SALT_KEY) as string);

    expect(mainSalt).toHaveLength(16);
    expect(privateSalt).toHaveLength(16);
    expect(stored(STORAGE_SALT_KEY)).not.toBe(stored(STORAGE_PRIVATE_SALT_KEY));
  });

  it('starts with an empty data object', async () => {
    const manager = await createUnlocked();

    expect(manager.getData('members')).toBeNull();
    const plaintext = await decryptString(
      JSON.parse(stored(STORAGE_DATA_KEY) as string),
      await keyFor(STORAGE_SALT_KEY),
    );
    expect(JSON.parse(plaintext)).toEqual({});
  });

  it('rejects an empty passphrase without writing anything', async () => {
    await expect(new StorageManager().setup('')).rejects.toThrow('must not be empty');

    expect(getStorageStatus()).toBe('first-launch');
  });

  it('keeps whitespace in the passphrase instead of trimming it', async () => {
    await new StorageManager().setup('  spaced  ');

    const wrongManager = new StorageManager();
    await expect(wrongManager.unlock('spaced')).rejects.toBeInstanceOf(WrongPassphraseError);
    await expect(new StorageManager().unlock('  spaced  ')).resolves.toBeUndefined();
  });

  it('refuses to overwrite storage that already exists', async () => {
    await createUnlocked();

    await expect(new StorageManager().setup('another')).rejects.toThrow('already initialised');
  });

  it('removes partial state and rethrows when storage is full during setup', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === STORAGE_CHECK_KEY) throw new DOMException('full', 'QuotaExceededError');
    });

    await expect(new StorageManager().setup(PASSPHRASE)).rejects.toBeInstanceOf(StorageWriteError);
    vi.restoreAllMocks();

    expect(getStorageStatus()).toBe('first-launch');
  });
});

describe('unlock', () => {
  it('restores data written by an earlier session', async () => {
    const first = await createUnlocked();
    first.setData('members', [{ id: 'm1', name: 'Zoë' }]);

    const second = await relock(first);

    expect(second.getData('members')).toEqual([{ id: 'm1', name: 'Zoë' }]);
  });

  it('rejects a wrong passphrase and stays locked', async () => {
    await (await createUnlocked()).lock();
    const manager = new StorageManager();

    await expect(manager.unlock('not the passphrase')).rejects.toBeInstanceOf(WrongPassphraseError);

    expect(manager.isUnlocked).toBe(false);
  });

  it('treats a missing salt as corrupted data, not a wrong passphrase', async () => {
    await (await createUnlocked()).lock();
    window.localStorage.removeItem(STORAGE_SALT_KEY);

    await expect(new StorageManager().unlock(PASSPHRASE)).rejects.toBeInstanceOf(
      CorruptedDataError,
    );
  });

  it('treats a malformed envelope as corrupted data', async () => {
    await (await createUnlocked()).lock();
    window.localStorage.setItem(STORAGE_DATA_KEY, '{"v":2}');

    await expect(new StorageManager().unlock(PASSPHRASE)).rejects.toBeInstanceOf(
      CorruptedDataError,
    );
  });

  it('treats an envelope that fails authentication as corrupted data', async () => {
    await (await createUnlocked()).lock();
    const envelope = JSON.parse(stored(STORAGE_DATA_KEY) as string);
    window.localStorage.setItem(
      STORAGE_DATA_KEY,
      JSON.stringify({ ...envelope, ct: stored(STORAGE_SALT_KEY) }),
    );

    await expect(new StorageManager().unlock(PASSPHRASE)).rejects.toBeInstanceOf(
      CorruptedDataError,
    );
  });

  it('starts empty and flags recovery when the decrypted data is not valid JSON', async () => {
    await (await createUnlocked()).lock();
    writeEnvelope(
      STORAGE_DATA_KEY,
      await encryptString('not json', await keyFor(STORAGE_SALT_KEY)),
    );
    const manager = new StorageManager();

    await manager.unlock(PASSPHRASE);

    expect(manager.getData('members')).toBeNull();
    expect(manager.didRecoverFromCorruption).toBe(true);
  });

  it('does not decrypt the private envelope until loadPrivate is called', async () => {
    const manager = await relock(await createUnlocked());

    expect(manager.isUnlocked).toBe(true);
    expect(manager.isPrivateUnlocked).toBe(false);
  });
});

describe('data access', () => {
  it('throws when reading or writing while locked', async () => {
    const manager = new StorageManager();

    expect(() => manager.getData('members')).toThrow('locked');
    expect(() => manager.setData('members', [])).toThrow('locked');
  });

  it('returns null for a key that was never written', async () => {
    const manager = await createUnlocked();

    expect(manager.getData('moods')).toBeNull();
  });

  it('rejects the __proto__ key', async () => {
    const manager = await createUnlocked();

    expect(() => manager.setData('__proto__', { polluted: true })).toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('returns a value immediately after setData, before it is persisted', async () => {
    const manager = await createUnlocked();
    const before = stored(STORAGE_DATA_KEY);

    manager.setData('settings', { theme: 'dark' });

    expect(manager.getData('settings')).toEqual({ theme: 'dark' });
    expect(stored(STORAGE_DATA_KEY)).toBe(before);
  });

  it('keeps shared data out of the stored plaintext', async () => {
    const manager = await createUnlocked();
    manager.setData('members', [{ name: 'Distinctive Name' }]);
    await manager.flush();

    expect(stored(STORAGE_DATA_KEY)).not.toContain('Distinctive Name');
  });
});

describe('debounced writes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  it('collapses rapid writes into a single write after the debounce window', async () => {
    const manager = await createUnlocked();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    manager.setData('notes', 'a');
    manager.setData('notes', 'b');
    manager.setData('notes', 'c');
    await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS - 1);
    expect(setItem).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await manager.flush();

    expect(setItem.mock.calls.filter(([key]) => key === STORAGE_DATA_KEY)).toHaveLength(1);
    expect((await relock(manager)).getData('notes')).toBe('c');
  });

  it('restarts the window on each write', async () => {
    const manager = await createUnlocked();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    manager.setData('notes', 'a');
    await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS - 100);
    manager.setData('notes', 'b');
    await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS - 100);

    expect(setItem).not.toHaveBeenCalled();
  });

  it('writes immediately on flush and does nothing when nothing is pending', async () => {
    const manager = await createUnlocked();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    manager.setData('notes', 'x');
    await manager.flush();
    expect(setItem).toHaveBeenCalledTimes(1);
    await manager.flush();

    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('uses a fresh IV for every write', async () => {
    const manager = await createUnlocked();

    manager.setData('notes', 'x');
    await manager.flush();
    const firstIv = JSON.parse(stored(STORAGE_DATA_KEY) as string).iv;
    manager.setData('notes', 'x');
    await manager.flush();

    expect(JSON.parse(stored(STORAGE_DATA_KEY) as string).iv).not.toBe(firstIv);
  });

  it('keeps independent timers for the main and private envelopes', async () => {
    const manager = await createUnlocked();
    await manager.loadPrivate();
    const written = () =>
      setItem.mock.calls.map(([key]) => key).filter((key) => key !== STORAGE_CHECK_KEY);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    manager.setPrivateData('flightRisk', { m1: 'low' });
    await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS - 100);
    manager.setData('notes', 'x');
    await vi.advanceTimersByTimeAsync(100);
    await vi.waitFor(() => expect(written()).toEqual([STORAGE_PRIVATE_KEY]));

    await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);
    await vi.waitFor(() => expect(written()).toEqual([STORAGE_PRIVATE_KEY, STORAGE_DATA_KEY]));
  });
});

describe('lock', () => {
  it('persists pending writes before clearing the in-memory data', async () => {
    const manager = await createUnlocked();
    manager.setData('notes', 'pending');

    await manager.lock();

    expect(manager.isUnlocked).toBe(false);
    expect(() => manager.getData('notes')).toThrow('locked');
    const next = new StorageManager();
    await next.unlock(PASSPHRASE);
    expect(next.getData('notes')).toBe('pending');
  });

  it('clears the private cache as well', async () => {
    const manager = await createUnlocked();
    await manager.loadPrivate();

    await manager.lock();

    expect(manager.isPrivateUnlocked).toBe(false);
    expect(() => manager.getPrivateData('flightRisk')).toThrow('locked');
  });

  it('resolves immediately when already locked', async () => {
    await expect(new StorageManager().lock()).resolves.toBeUndefined();
  });

  it('lets the app unlock again right after locking', async () => {
    const manager = await createUnlocked();
    manager.setData('notes', 'kept');

    const locking = manager.lock();
    await manager.unlock(PASSPHRASE);
    await locking;

    expect(manager.getData('notes')).toBe('kept');
  });
});

describe('private envelope', () => {
  it('refuses private reads and writes until the envelope is loaded', async () => {
    const manager = await createUnlocked();

    expect(() => manager.getPrivateData('flightRisk')).toThrow('loadPrivate');
    expect(() => manager.setPrivateData('flightRisk', {})).toThrow('loadPrivate');
  });

  it('round-trips private data through its own envelope', async () => {
    const first = await createUnlocked();
    await first.loadPrivate();
    first.setPrivateData('flightRisk', { m1: 'high' });
    await first.flush();
    const second = await relock(first);

    await second.loadPrivate();

    expect(second.isPrivateUnlocked).toBe(true);
    expect(second.getPrivateData('flightRisk')).toEqual({ m1: 'high' });
  });

  it('stores private data only in the private envelope', async () => {
    const manager = await createUnlocked();
    await manager.loadPrivate();
    manager.setPrivateData('flightRisk', { m1: 'high' });
    await manager.flush();

    const mainPlaintext = await decryptString(
      JSON.parse(stored(STORAGE_DATA_KEY) as string),
      await keyFor(STORAGE_SALT_KEY),
    );
    expect(mainPlaintext).not.toContain('flightRisk');
    expect(manager.getData('flightRisk')).toBeNull();
  });

  it('cannot be decrypted with the main envelope key', async () => {
    const manager = await createUnlocked();
    await manager.loadPrivate();
    manager.setPrivateData('flightRisk', { m1: 'high' });
    await manager.flush();

    await expect(
      decryptString(
        JSON.parse(stored(STORAGE_PRIVATE_KEY) as string),
        await keyFor(STORAGE_SALT_KEY),
      ),
    ).rejects.toThrow();
  });

  it('reports corrupted data when the private envelope cannot be decrypted', async () => {
    const manager = await relock(await createUnlocked());
    const envelope = JSON.parse(stored(STORAGE_PRIVATE_KEY) as string);
    window.localStorage.setItem(
      STORAGE_PRIVATE_KEY,
      JSON.stringify({ ...envelope, ct: stored(STORAGE_SALT_KEY) }),
    );

    await expect(manager.loadPrivate()).rejects.toBeInstanceOf(CorruptedDataError);
  });

  it('throws from loadPrivate while locked', async () => {
    await expect(new StorageManager().loadPrivate()).rejects.toThrow('locked');
  });
});

describe('write failures', () => {
  function failWrites(key: string, times: number) {
    const original = Storage.prototype.setItem;
    let remaining = times;
    return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      name: string,
      value: string,
    ) {
      if (name === key && remaining > 0) {
        remaining -= 1;
        throw new DOMException('full', 'QuotaExceededError');
      }
      original.call(this, name, value);
    });
  }

  it('reports a quota error, keeps the data in memory and saves it on the next flush', async () => {
    const manager = await createUnlocked();
    const listener = vi.fn();
    manager.onWriteError(listener);
    failWrites(STORAGE_DATA_KEY, 1);

    manager.setData('notes', 'big');
    await manager.flush();

    expect(listener).toHaveBeenCalledTimes(1);
    const error = listener.mock.calls[0][0] as StorageWriteError;
    expect(error.isQuotaExceeded).toBe(true);
    expect(error.isPrivate).toBe(false);
    expect(manager.getData('notes')).toBe('big');

    await manager.flush();
    expect((await relock(manager)).getData('notes')).toBe('big');
  });

  it('resolves flush with the failure, or null once everything is saved', async () => {
    const manager = await createUnlocked();
    failWrites(STORAGE_DATA_KEY, 1);

    manager.setData('notes', 'big');
    const failure = await manager.flush();

    expect(failure).toBeInstanceOf(StorageWriteError);
    expect(failure?.isQuotaExceeded).toBe(true);
    expect(await manager.flush()).toBeNull();
  });

  it('retries a failed private write once without reporting an error', async () => {
    const manager = await createUnlocked();
    await manager.loadPrivate();
    const listener = vi.fn();
    manager.onWriteError(listener);
    failWrites(STORAGE_PRIVATE_KEY, 1);

    manager.setPrivateData('flightRisk', { m1: 'low' });
    await manager.flush();

    expect(listener).not.toHaveBeenCalled();
    const next = await relock(manager);
    await next.loadPrivate();
    expect(next.getPrivateData('flightRisk')).toEqual({ m1: 'low' });
  });

  it('reports a private write that fails twice and leaves main data alone', async () => {
    const manager = await createUnlocked();
    await manager.loadPrivate();
    const listener = vi.fn();
    manager.onWriteError(listener);
    failWrites(STORAGE_PRIVATE_KEY, 2);

    manager.setData('notes', 'main ok');
    manager.setPrivateData('flightRisk', { m1: 'low' });
    await manager.flush();

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as StorageWriteError).isPrivate).toBe(true);
    const next = new StorageManager();
    await next.unlock(PASSPHRASE);
    expect(next.getData('notes')).toBe('main ok');
  });

  it('stops notifying after unsubscribing', async () => {
    const manager = await createUnlocked();
    const listener = vi.fn();
    const unsubscribe = manager.onWriteError(listener);
    unsubscribe();
    failWrites(STORAGE_DATA_KEY, 1);

    manager.setData('notes', 'x');
    await manager.flush();

    expect(listener).not.toHaveBeenCalled();
  });
});
