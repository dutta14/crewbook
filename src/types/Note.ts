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
   * Whether the note may appear in a share link. It also says where the note is stored: shared
   * notes live in the main envelope and private ones in the private envelope. Always 'private'
   * unless the manager has explicitly shared the note.
   */
  visibility: NoteVisibility;
}
