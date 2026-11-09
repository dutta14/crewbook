import { describe, expect, it } from 'vitest';
import type { StorageWriteError } from '../utils/encryptedStorage';
import { ValidationError } from './errors';
import {
  areLiveShortcutsEnabled,
  areRiskIndicatorsHidden,
  dismissLiveNotice,
  getDefaultNoteVisibility,
  getManagerName,
  isLiveNoticeDismissed,
  isMoodTrackingEnabled,
  readAppSettings,
  setDefaultNoteVisibility,
  setLiveShortcutsEnabled,
  setManagerName,
  setMoodTrackingEnabled,
  setRiskIndicatorsHidden,
  updateAppSetting,
  type SettingsStorage,
} from './settings';

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

describe('default note visibility', () => {
  it('is private until the manager chooses shared', async () => {
    const { storage, store } = createStorage({ other: 'kept' });
    expect(getDefaultNoteVisibility(storage)).toBe('private');

    await setDefaultNoteVisibility('shared', storage);

    expect(getDefaultNoteVisibility(storage)).toBe('shared');
    expect(store.get('settings')).toEqual({ other: 'kept', defaultNoteVisibility: 'shared' });
  });

  it.each([undefined, '', 'Shared', 'SHARED', 'true', 'public', 1, true, null])(
    'reads a stored value of %j as private',
    (value) => {
      const { storage } = createStorage({ defaultNoteVisibility: value });

      expect(getDefaultNoteVisibility(storage)).toBe('private');
    },
  );

  it('is private when settings are corrupt', () => {
    expect(getDefaultNoteVisibility(createStorage('nonsense').storage)).toBe('private');
    expect(getDefaultNoteVisibility(createStorage(['shared']).storage)).toBe('private');
  });

  it('rejects an invalid value without writing it', async () => {
    const { storage, store } = createStorage({ other: 'kept' });

    await expect(setDefaultNoteVisibility('everyone' as never, storage)).rejects.toThrow(
      ValidationError,
    );

    expect(store.get('settings')).toEqual({ other: 'kept' });
  });

  it('restores the previous value when the write fails', async () => {
    const { storage } = createStorage();
    storage.failWith = new Error('full') as StorageWriteError;

    await expect(setDefaultNoteVisibility('shared', storage)).rejects.toBe(storage.failWith);

    expect(getDefaultNoteVisibility(storage)).toBe('private');
  });
});

describe('risk indicator setting', () => {
  it('shows indicators until the manager hides them', async () => {
    const { storage, store } = createStorage({ other: 'kept' });
    expect(areRiskIndicatorsHidden(storage)).toBe(false);

    await setRiskIndicatorsHidden(true, storage);

    expect(areRiskIndicatorsHidden(storage)).toBe(true);
    expect(store.get('settings')).toEqual({ other: 'kept', hideRiskIndicators: 'true' });
  });

  it('restores the previous value when the write fails', async () => {
    const { storage } = createStorage();
    const failure = new Error('full') as StorageWriteError;
    storage.failWith = failure;

    await expect(setRiskIndicatorsHidden(true, storage)).rejects.toBe(failure);

    expect(areRiskIndicatorsHidden(storage)).toBe(false);
  });
});

describe('live mode settings', () => {
  it('has shortcuts on and the notice unseen by default', () => {
    const { storage } = createStorage();

    expect(areLiveShortcutsEnabled(storage)).toBe(true);
    expect(isLiveNoticeDismissed(storage)).toBe(false);
  });

  it('persists the shortcut toggle and the dismissed notice without losing other settings', async () => {
    const { storage, store } = createStorage({ moodTrackingEnabled: 'true' });

    await setLiveShortcutsEnabled(false, storage);
    await dismissLiveNotice(storage);

    expect(areLiveShortcutsEnabled(storage)).toBe(false);
    expect(isLiveNoticeDismissed(storage)).toBe(true);
    expect(store.get('settings')).toEqual({
      moodTrackingEnabled: 'true',
      liveModeShortcuts: 'false',
      liveModeNoticeDismissed: 'true',
    });
  });

  it('has no manager name until one is saved, and keeps other settings when saving it', async () => {
    const { storage, store } = createStorage({ moodTrackingEnabled: 'true' });
    expect(getManagerName(storage)).toBe('');

    await setManagerName('Morgan Lee', storage);

    expect(getManagerName(storage)).toBe('Morgan Lee');
    expect(store.get('settings')).toEqual({
      moodTrackingEnabled: 'true',
      managerName: 'Morgan Lee',
    });
  });
});

describe('app configuration settings', () => {
  it('falls back to the defaults for anything missing or not on the list', () => {
    const { storage } = createStorage({
      defaultCadence: 'daily',
      dateFormat: 'YYYY',
      firstDayOfWeek: 'friday',
      privateAutoLockMinutes: '7',
    });

    expect(readAppSettings(storage)).toEqual({
      defaultCadence: 'weekly',
      dateFormat: 'MM/DD/YYYY',
      firstDayOfWeek: 'monday',
      defaultNoteVisibility: 'private',
      moodTrackingEnabled: false,
      hideRiskIndicators: false,
      liveShortcutsEnabled: true,
      privateAutoLockMinutes: 5,
      managerName: '',
    });
  });

  it('stores each preference as text and reads it back', async () => {
    const { storage, store } = createStorage();

    await updateAppSetting('defaultCadence', 'monthly', storage);
    await updateAppSetting('dateFormat', 'DD/MM/YYYY', storage);
    await updateAppSetting('firstDayOfWeek', 'sunday', storage);
    await updateAppSetting('privateAutoLockMinutes', 0, storage);

    expect(store.get('settings')).toEqual({
      defaultCadence: 'monthly',
      dateFormat: 'DD/MM/YYYY',
      firstDayOfWeek: 'sunday',
      privateAutoLockMinutes: '0',
    });
    expect(readAppSettings(storage)).toMatchObject({
      defaultCadence: 'monthly',
      dateFormat: 'DD/MM/YYYY',
      firstDayOfWeek: 'sunday',
      privateAutoLockMinutes: 0,
    });
  });

  it.each([
    ['defaultCadence', 'daily'],
    ['dateFormat', 'YYYY-MM-DD'],
    ['firstDayOfWeek', 'friday'],
    ['privateAutoLockMinutes', 7],
  ] as const)('rejects %s = %s and stores nothing', async (key, value) => {
    const { storage, store } = createStorage();

    await expect(updateAppSetting(key, value as never, storage)).rejects.toBeInstanceOf(
      ValidationError,
    );

    expect(store.has('settings')).toBe(false);
  });
});
