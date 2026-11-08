export interface Note {
  id: string;
  memberId: string;
  /** Raw markdown. It is sanitized when rendered, never when stored. */
  content: string;
  /** ISO 8601. Notes can only be edited for 24 hours after this moment. */
  createdAt: string;
  updatedAt: string;
}
