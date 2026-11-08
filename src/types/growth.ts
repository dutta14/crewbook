export type GrowthChangeType = 'promotion' | 'role_change' | 'team_transfer' | 'title_update';

/** One step in a person's career at the company. Career history is sensitive, so it stays private. */
export interface GrowthEntry {
  /** crypto.randomUUID() */
  id: string;
  engineerId: string;
  /** Calendar day, YYYY-MM-DD. */
  date: string;
  changeType: GrowthChangeType;
  from: string;
  to: string;
  notes: string;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

/** What the manager types; everything else is set by the store. */
export type GrowthEntryInput = Pick<GrowthEntry, 'date' | 'changeType' | 'from' | 'to' | 'notes'>;
