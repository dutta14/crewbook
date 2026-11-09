/**
 * A topic for the next 1:1. Seam for the agenda issue, which owns creating and archiving these;
 * sharing only reads them.
 */
export interface AgendaItem {
  id: string;
  memberId: string;
  text: string;
  addedBy: 'manager' | 'engineer';
  /** ISO 8601. */
  createdAt: string;
  /** Only items marked true leave the manager's device in a share link. Absent means not shared. */
  includeInShare?: boolean;
}
