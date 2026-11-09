/**
 * A topic for the next 1:1. The manager creates these in their own app, either for themselves or
 * on behalf of the engineer, who passes topics on by chat or email. Sharing only reads them.
 */
export interface AgendaItem {
  id: string;
  memberId: string;
  /** Plain text, at most 500 characters, with no markup. */
  text: string;
  addedBy: 'manager' | 'engineer';
  /** ISO 8601. */
  createdAt: string;
  /** Only items marked true leave the manager's device in a share link. Absent means not shared. */
  includeInShare?: boolean;
  /** Ticked in live mode. */
  discussed?: boolean;
  /** Set when a later 1:1 is recorded. Archived items are kept but are no longer on the agenda. */
  archived?: boolean;
  /** ISO 8601. */
  archivedAt?: string;
}
