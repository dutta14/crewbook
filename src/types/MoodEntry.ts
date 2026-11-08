export type MoodScore = 1 | 2 | 3 | 4 | 5;

export interface MoodEntry {
  id: string;
  memberId: string;
  /** The 1:1 note it was logged with. A note has at most one entry. */
  noteId: string;
  score: MoodScore;
  /** ISO 8601 */
  recordedAt: string;
}
