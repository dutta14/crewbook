import type { TeamMemberStatus } from './TeamMember';

export interface PrepStatusChange {
  status: TeamMemberStatus;
  /** ISO 8601 */
  changedAt: string;
  daysAgo: number;
}

/** Everything the prep card shows. Derived on render from the in-memory store and never stored. */
export interface PrepData {
  daysSinceLastMeeting: number;
  /** Null when the person has no 1:1 schedule, so there is nothing to measure "overdue" against. */
  cadenceDays: number | null;
  /** True once the gap is more than 1.5 times the cadence. */
  isOverdue: boolean;
  openActionItems: Array<{ id: string; title: string }>;
  /** The start of the last note, cut at a word boundary; null when it has nothing to show. */
  lastDiscussedSummary: string | null;
  /** Status changes made since the last 1:1, newest first. */
  recentStatusChanges: PrepStatusChange[];
}
