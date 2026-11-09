import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';

/** A property on the decrypted `crewbook_data` object; AppData types its values as strings. */
const STORAGE_KEY = 'settings';
const MOOD_TRACKING_KEY = 'moodTrackingEnabled';
const HIDE_RISK_KEY = 'hideRiskIndicators';
const LIVE_SHORTCUTS_KEY = 'liveModeShortcuts';
const LIVE_NOTICE_KEY = 'liveModeNoticeDismissed';
const MANAGER_NAME_KEY = 'managerName';

export type SettingsStorage = Pick<EncryptedStorageContextValue, 'get' | 'set' | 'flush'>;

function readSettings(storage: Pick<SettingsStorage, 'get'>): Record<string, string> {
  const stored = storage.get<unknown>(STORAGE_KEY);
  return typeof stored === 'object' && stored !== null && !Array.isArray(stored)
    ? (stored as Record<string, string>)
    : {};
}

export function getSetting(storage: Pick<SettingsStorage, 'get'>, key: string): string | undefined {
  const value = readSettings(storage)[key];
  return typeof value === 'string' ? value : undefined;
}

/** Off until the manager opts in, because ratings are a private judgement about a person. */
export function isMoodTrackingEnabled(storage: Pick<SettingsStorage, 'get'>): boolean {
  return readSettings(storage)[MOOD_TRACKING_KEY] === 'true';
}

export async function writeSetting(
  key: string,
  value: string,
  storage: SettingsStorage,
): Promise<void> {
  const previous = readSettings(storage);
  storage.set(STORAGE_KEY, { ...previous, [key]: value });
  const failure = await storage.flush();
  if (!failure) return;
  try {
    storage.set(STORAGE_KEY, previous);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
  throw failure;
}

/** Turning tracking off hides mood controls and charts but keeps stored ratings. */
export function setMoodTrackingEnabled(enabled: boolean, storage: SettingsStorage): Promise<void> {
  return writeSetting(MOOD_TRACKING_KEY, String(enabled), storage);
}

/** Visible unless the manager hides them, for example before sharing their screen. */
export function areRiskIndicatorsHidden(storage: Pick<SettingsStorage, 'get'>): boolean {
  return readSettings(storage)[HIDE_RISK_KEY] === 'true';
}

export function setRiskIndicatorsHidden(hidden: boolean, storage: SettingsStorage): Promise<void> {
  return writeSetting(HIDE_RISK_KEY, String(hidden), storage);
}

/** The name the engineer sees on a shared 1:1 page. Empty until the manager enters one. */
export function getManagerName(storage: Pick<SettingsStorage, 'get'>): string {
  return readSettings(storage)[MANAGER_NAME_KEY] ?? '';
}

export function setManagerName(name: string, storage: SettingsStorage): Promise<void> {
  return writeSetting(MANAGER_NAME_KEY, name, storage);
}

/** On unless the manager turns them off, because live mode's shortcuts can clash with a browser's. */
export function areLiveShortcutsEnabled(storage: Pick<SettingsStorage, 'get'>): boolean {
  return readSettings(storage)[LIVE_SHORTCUTS_KEY] !== 'false';
}

export function setLiveShortcutsEnabled(enabled: boolean, storage: SettingsStorage): Promise<void> {
  return writeSetting(LIVE_SHORTCUTS_KEY, String(enabled), storage);
}

/** The one-time reminder to tell the team that notes are taken during 1:1s. */
export function isLiveNoticeDismissed(storage: Pick<SettingsStorage, 'get'>): boolean {
  return readSettings(storage)[LIVE_NOTICE_KEY] === 'true';
}

export function dismissLiveNotice(storage: SettingsStorage): Promise<void> {
  return writeSetting(LIVE_NOTICE_KEY, 'true', storage);
}
