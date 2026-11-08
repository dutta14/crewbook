import type { Schedule } from './Schedule';
import type { MemberChange } from './Timeline';

export type TeamMemberStatus = 'active' | 'on_leave' | 'departing' | 'new_hire';

export interface TeamMember {
  /** crypto.randomUUID() */
  id: string;
  /** Also the accessible name for the member's avatar in downstream UI. */
  name: string;
  role: string;
  level: string;
  /** ISO 8601 date or date-time. */
  startDate: string;
  email: string;
  /** The id of this member's manager, or null. */
  manager: string | null;
  status: TeamMemberStatus;
  avatarUrl?: string;
  customFields: Record<string, string>;
  /** Recurring 1:1 schedule. Stays inside the encrypted member record. */
  schedule?: Schedule;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601; refreshed on every write. */
  updatedAt: string;
  /** Edits recorded by updateMember, oldest first. Absent until the first edit. */
  history?: MemberChange[];
}

/** Everything the caller supplies when creating a member. */
export type TeamMemberInput = Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt' | 'history'>;

/** Only the fields that change; id and createdAt are immutable. */
export type TeamMemberUpdate = Partial<Omit<TeamMember, 'id' | 'createdAt' | 'history'>>;
