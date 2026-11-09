export type NoteVisibility = 'shared' | 'private';

export interface Note {
  id: string;
  memberId: string;
  /** Raw markdown. It is sanitized when rendered, never when stored. */
  content: string;
  /** ISO 8601. Notes can only be edited for 24 hours after this moment. */
  createdAt: string;
  updatedAt: string;
  /**
   * Whether the note may appear in a share link. Absent means private: a note is only shared when
   * it says so. Seam for the issue that adds the per-note toggle.
   */
  visibility?: NoteVisibility;
}
