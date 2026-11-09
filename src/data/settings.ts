import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { NoteVisibility } from '../types/Note';
import {
  AUTO_LOCK_OPTIONS,
  CADENCE_OPTIONS,
  DATE_FORMATS,
  DEFAULT_SETTINGS,
  FIRST_DAYS_OF_WEEK,
  type AppSettings,
  type CadenceOption,
  type DateFormat,
  type FirstDayOfWeek,
  type PrivateAutoLockTimeout,
} from '../types/settings';
import { ValidationError } from './errors';

/** A property on the decrypted `crewbook_data` object; AppData types its values as strings. */
const STORAGE_KEY = 'settings';
const MOOD_TRACKING_KEY = 'moodTrackingEnabled';
const HIDE_RISK_KEY = 'hideRiskIndicators';
const LIVE_SHORTCUTS_KEY = 'liveModeShortcuts';
const LIVE_NOTICE_KEY = 'liveModeNoticeDismissed';
const LAST_BACKUP_KEY = 'lastBackupAt';
const MANAGER_NAME_KEY = 'managerName';
const DEFAULT_NOTE_VISIBILITY_KEY = 'defaultNoteVisibility';
const DEFAULT_CADENCE_KEY = 'defaultCadence';
const DATE_FORMAT_KEY = 'dateFormat';
const FIRST_DAY_KEY = 'firstDayOfWeek';
const AUTO_LOCK_KEY = 'privateAutoLockMinutes';

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

export function isNoteVisibility(value: unknown): value is NoteVisibility {
  return value === 'shared' || value === 'private';
}

/** Fails closed: anything other than an explicit 'shared' (missing, corrupt, odd) is private. */
export function getDefaultNoteVisibility(storage: Pick<SettingsStorage, 'get'>): NoteVisibility {
  return readSettings(storage)[DEFAULT_NOTE_VISIBILITY_KEY] === 'shared' ? 'shared' : 'private';
}

export function setDefaultNoteVisibility(
  visibility: NoteVisibility,
  storage: SettingsStorage,
): Promise<void> {
  if (!isNoteVisibility(visibility)) {
    return Promise.reject(new ValidationError('Choose shared or private'));
  }
  return writeSetting(DEFAULT_NOTE_VISIBILITY_KEY, visibility, storage);
}

/** Fails back to the default for anything missing, corrupt or not one of the known choices. */
export function getDefaultCadence(storage: Pick<SettingsStorage, 'get'>): CadenceOption {
  const stored = readSettings(storage)[DEFAULT_CADENCE_KEY];
  return CADENCE_OPTIONS.find((option) => option === stored) ?? DEFAULT_SETTINGS.defaultCadence;
}

export function setDefaultCadence(cadence: CadenceOption, storage: SettingsStorage): Promise<void> {
  if (!CADENCE_OPTIONS.includes(cadence)) {
    return Promise.reject(new ValidationError('Choose weekly, biweekly or monthly'));
  }
  return writeSetting(DEFAULT_CADENCE_KEY, cadence, storage);
}

export function getDateFormat(storage: Pick<SettingsStorage, 'get'>): DateFormat {
  const stored = readSettings(storage)[DATE_FORMAT_KEY];
  return DATE_FORMATS.find((option) => option === stored) ?? DEFAULT_SETTINGS.dateFormat;
}

export function setDateFormat(format: DateFormat, storage: SettingsStorage): Promise<void> {
  if (!DATE_FORMATS.includes(format)) {
    return Promise.reject(new ValidationError('Choose a date format'));
  }
  return writeSetting(DATE_FORMAT_KEY, format, storage);
}

export function getFirstDayOfWeek(storage: Pick<SettingsStorage, 'get'>): FirstDayOfWeek {
  const stored = readSettings(storage)[FIRST_DAY_KEY];
  return FIRST_DAYS_OF_WEEK.find((option) => option === stored) ?? DEFAULT_SETTINGS.firstDayOfWeek;
}

export function setFirstDayOfWeek(day: FirstDayOfWeek, storage: SettingsStorage): Promise<void> {
  if (!FIRST_DAYS_OF_WEEK.includes(day)) {
    return Promise.reject(new ValidationError('Choose Sunday or Monday'));
  }
  return writeSetting(FIRST_DAY_KEY, day, storage);
}

export function getPrivateAutoLockMinutes(
  storage: Pick<SettingsStorage, 'get'>,
): PrivateAutoLockTimeout {
  const stored = readSettings(storage)[AUTO_LOCK_KEY];
  return (
    AUTO_LOCK_OPTIONS.find((option) => String(option) === stored) ??
    DEFAULT_SETTINGS.privateAutoLockMinutes
  );
}

export function setPrivateAutoLockMinutes(
  minutes: PrivateAutoLockTimeout,
  storage: SettingsStorage,
): Promise<void> {
  if (!AUTO_LOCK_OPTIONS.includes(minutes)) {
    return Promise.reject(new ValidationError('Choose a timeout from the list'));
  }
  return writeSetting(AUTO_LOCK_KEY, String(minutes), storage);
}

/** Every preference at once, each already checked against its allowed values. */
export function readAppSettings(storage: Pick<SettingsStorage, 'get'>): AppSettings {
  return {
    defaultCadence: getDefaultCadence(storage),
    dateFormat: getDateFormat(storage),
    firstDayOfWeek: getFirstDayOfWeek(storage),
    defaultNoteVisibility: getDefaultNoteVisibility(storage),
    moodTrackingEnabled: isMoodTrackingEnabled(storage),
    hideRiskIndicators: areRiskIndicatorsHidden(storage),
    liveShortcutsEnabled: areLiveShortcutsEnabled(storage),
    privateAutoLockMinutes: getPrivateAutoLockMinutes(storage),
    managerName: getManagerName(storage),
  };
}

const SETTERS: {
  [K in keyof AppSettings]: (value: AppSettings[K], s: SettingsStorage) => Promise<void>;
} = {
  defaultCadence: setDefaultCadence,
  dateFormat: setDateFormat,
  firstDayOfWeek: setFirstDayOfWeek,
  defaultNoteVisibility: setDefaultNoteVisibility,
  moodTrackingEnabled: setMoodTrackingEnabled,
  hideRiskIndicators: setRiskIndicatorsHidden,
  liveShortcutsEnabled: setLiveShortcutsEnabled,
  privateAutoLockMinutes: setPrivateAutoLockMinutes,
  managerName: setManagerName,
};

/** Validates, applies and persists one preference; rolls it back if the write fails. */
export function updateAppSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
  storage: SettingsStorage,
): Promise<void> {
  return SETTERS[key](value, storage);
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

/** When the last full backup was made, as an ISO timestamp, or undefined if there has not been one. */
export function getLastBackupAt(storage: Pick<SettingsStorage, 'get'>): string | undefined {
  return getSetting(storage, LAST_BACKUP_KEY);
}

export function setLastBackupAt(iso: string, storage: SettingsStorage): Promise<void> {
  return writeSetting(LAST_BACKUP_KEY, iso, storage);
}
