export type MoodScore = 1 | 2 | 3 | 4 | 5;

export interface MoodEntry {
  id: string;
  memberId: string;
  score: MoodScore;
  recordedAt: string;
}
