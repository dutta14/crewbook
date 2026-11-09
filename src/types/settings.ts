import type { NoteVisibility } from './Note';

export type { NoteVisibility };

export type CadenceOption = 'weekly' | 'biweekly' | 'monthly';
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY';
export type FirstDayOfWeek = 'sunday' | 'monday';
/** Minutes of inactivity before a private view closes. 0 means never. */
export type PrivateAutoLockTimeout = 1 | 2 | 5 | 10 | 15 | 0;

export const CADENCE_OPTIONS: readonly CadenceOption[] = ['weekly', 'biweekly', 'monthly'];
export const DATE_FORMATS: readonly DateFormat[] = ['MM/DD/YYYY', 'DD/MM/YYYY'];
export const FIRST_DAYS_OF_WEEK: readonly FirstDayOfWeek[] = ['sunday', 'monday'];
export const AUTO_LOCK_OPTIONS: readonly PrivateAutoLockTimeout[] = [1, 2, 5, 10, 15, 0];

/**
 * Every preference kept in the encrypted `settings` object, as typed values. The theme is not in
 * here: it must apply on the lock screen, so it lives beside the lock in `useDarkMode`.
 */
export interface AppSettings {
  defaultCadence: CadenceOption;
  dateFormat: DateFormat;
  firstDayOfWeek: FirstDayOfWeek;
  defaultNoteVisibility: NoteVisibility;
  moodTrackingEnabled: boolean;
  hideRiskIndicators: boolean;
  liveShortcutsEnabled: boolean;
  privateAutoLockMinutes: PrivateAutoLockTimeout;
  managerName: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultCadence: 'weekly',
  dateFormat: 'MM/DD/YYYY',
  // The calendar has always started on Monday, so that stays the starting point.
  firstDayOfWeek: 'monday',
  defaultNoteVisibility: 'private',
  moodTrackingEnabled: false,
  hideRiskIndicators: false,
  liveShortcutsEnabled: true,
  privateAutoLockMinutes: 5,
  managerName: '',
};
