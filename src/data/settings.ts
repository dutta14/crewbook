import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';

/** A property on the decrypted `crewbook_data` object; AppData types its values as strings. */
const STORAGE_KEY = 'settings';
const MOOD_TRACKING_KEY = 'moodTrackingEnabled';

export type SettingsStorage = Pick<EncryptedStorageContextValue, 'get' | 'set' | 'flush'>;

function readSettings(storage: Pick<SettingsStorage, 'get'>): Record<string, string> {
  const stored = storage.get<unknown>(STORAGE_KEY);
  return typeof stored === 'object' && stored !== null && !Array.isArray(stored)
    ? (stored as Record<string, string>)
    : {};
}

/** Off until the manager opts in, because ratings are a private judgement about a person. */
export function isMoodTrackingEnabled(storage: Pick<SettingsStorage, 'get'>): boolean {
  return readSettings(storage)[MOOD_TRACKING_KEY] === 'true';
}

/** Turning tracking off hides mood controls and charts but keeps stored ratings. */
export async function setMoodTrackingEnabled(
  enabled: boolean,
  storage: SettingsStorage,
): Promise<void> {
  const previous = readSettings(storage);
  storage.set(STORAGE_KEY, { ...previous, [MOOD_TRACKING_KEY]: String(enabled) });
  const failure = await storage.flush();
  if (!failure) return;
  try {
    storage.set(STORAGE_KEY, previous);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
  throw failure;
}
