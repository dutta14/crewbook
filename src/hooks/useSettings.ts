import { useCallback } from 'react';
import { readAppSettings, updateAppSetting } from '../data/settings';
import type { AppSettings } from '../types/settings';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useToast } from './useToast';

const SAVE_FAILED = "Couldn't save that setting. Try again.";

type SettingWriter = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;

export interface UseSettings {
  settings: AppSettings;
  /** Resolves once the value is saved; rejects, with the old value restored, if it is not. */
  updateSetting: SettingWriter;
  /** Like updateSetting, but also shows an error toast before rejecting. */
  saveSetting: SettingWriter;
}

/** The manager's preferences from the encrypted settings. Components re-render on every change. */
export function useSettings(): UseSettings {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const { get, set, flush } = storage;
  const settings = readAppSettings(storage);
  const updateSetting = useCallback<SettingWriter>(
    (key, value) => updateAppSetting(key, value, { get, set, flush }),
    [get, set, flush],
  );
  const saveSetting = useCallback<SettingWriter>(
    async (key, value) => {
      try {
        await updateSetting(key, value);
      } catch (error) {
        showToast(SAVE_FAILED, 'error');
        throw error;
      }
    },
    [updateSetting, showToast],
  );
  return { settings, updateSetting, saveSetting };
}
