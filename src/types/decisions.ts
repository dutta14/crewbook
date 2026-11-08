/** A choice made during a 1:1. Titles and rationale are private, so they stay in the encrypted store. */
export interface Decision {
  id: string;
  engineerId: string;
  title: string;
  /** The rationale. Empty when none was written down. */
  context: string;
  /** Calendar day the decision was recorded, YYYY-MM-DD. */
  date: string;
  /** The note that records the 1:1. Empty until the 1:1 has ended and its note exists. */
  linkedMeetingId: string;
  /** Calendar day of the linked 1:1, YYYY-MM-DD. Empty while it is not linked. */
  linkedMeetingDate: string;
  /** ISO 8601 */
  createdAt: string;
}

export type FollowUpStatus = 'pending' | 'done';

export interface FollowUp {
  id: string;
  engineerId: string;
  title: string;
  /** `manager` for the person running the 1:1, otherwise the id of a team member. */
  ownerId: string;
  /** Display name taken from the team list when the follow-up is created; never typed by the user. */
  ownerName: string;
  /** Calendar day, YYYY-MM-DD. */
  dueDate?: string;
  status: FollowUpStatus;
  linkedMeetingId: string;
  linkedMeetingDate: string;
  /** ISO 8601 */
  createdAt: string;
}

export type DecisionFollowUpFilter = 'all' | 'decisions' | 'follow-ups';
