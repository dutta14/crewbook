import { describe, expect, it } from 'vitest';
import type { StorageWriteError } from '../utils/encryptedStorage';
import { isMoodTrackingEnabled, setMoodTrackingEnabled, type SettingsStorage } from './settings';

function createStorage(initial: unknown = null) {
  const store = new Map<string, unknown>(initial === null ? [] : [['settings', initial]]);
  const storage: SettingsStorage & { failWith: StorageWriteError | null } = {
    failWith: null,
    get: <T>(key: string) => (store.has(key) ? (store.get(key) as T) : null),
    set: <T>(key: string, value: T) => void store.set(key, value),
    flush: async () => storage.failWith,
  };
  return { storage, store };
}

describe('settings', () => {
  it('has mood tracking off until the manager opts in', () => {
    expect(isMoodTrackingEnabled(createStorage().storage)).toBe(false);
    expect(isMoodTrackingEnabled(createStorage('junk').storage)).toBe(false);
    expect(isMoodTrackingEnabled(createStorage(['x']).storage)).toBe(false);
  });

  it('persists the toggle and keeps other settings', async () => {
    const { storage, store } = createStorage({ other: 'kept' });

    await setMoodTrackingEnabled(true, storage);
    expect(isMoodTrackingEnabled(storage)).toBe(true);
    expect(store.get('settings')).toEqual({ other: 'kept', moodTrackingEnabled: 'true' });

    await setMoodTrackingEnabled(false, storage);
    expect(isMoodTrackingEnabled(storage)).toBe(false);
  });

  it('restores the previous value when the write fails', async () => {
    const { storage } = createStorage({ moodTrackingEnabled: 'false' });
    const failure = new Error('full') as StorageWriteError;
    storage.failWith = failure;

    await expect(setMoodTrackingEnabled(true, storage)).rejects.toBe(failure);

    expect(isMoodTrackingEnabled(storage)).toBe(false);
  });
});
