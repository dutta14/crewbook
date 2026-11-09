import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type { AgendaItem } from '../types/agenda';

/** Agenda topics live in the private envelope until the agenda issue says otherwise. */
const STORAGE_KEY = 'agendaItems';

export type AgendaStorage = Pick<EncryptedStorageContextValue, 'getPrivate'>;

const isString = (value: unknown): value is string => typeof value === 'string';

function isAgendaItem(value: unknown): value is AgendaItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isString(item.id) &&
    isString(item.memberId) &&
    isString(item.text) &&
    (item.addedBy === 'manager' || item.addedBy === 'engineer') &&
    isString(item.createdAt) &&
    (item.includeInShare === undefined || typeof item.includeInShare === 'boolean')
  );
}

/**
 * Read-only for now: the agenda issue adds creating, editing and archiving. Until then nothing
 * writes this key, so the list is empty. Call loadPrivate first.
 */
export function listAgendaForMember(memberId: string, storage: AgendaStorage): AgendaItem[] {
  const stored = storage.getPrivate<unknown>(STORAGE_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isAgendaItem).filter((item) => item.memberId === memberId);
}
