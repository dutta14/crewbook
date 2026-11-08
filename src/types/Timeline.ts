export interface TimelineEntry {
  id: string;
  /** ISO 8601 */
  date: string;
  /** e.g. "Status changed from Active to On Leave" */
  description: string;
  /** Which field changed; absent for entries that are not a field change. */
  field?: string;
}

export type ChangedField =
  'name' | 'role' | 'level' | 'startDate' | 'email' | 'manager' | 'status' | 'customFields';

/**
 * One recorded edit. Only status keeps both values (it is a constrained enum). Other fields keep
 * the new value at most, and manager and custom fields keep none, so the history never copies
 * freeform data or relationships a second time.
 */
export interface MemberChange {
  id: string;
  /** ISO 8601 */
  date: string;
  field: ChangedField;
  from?: string;
  to?: string;
}
