import type { ActionItem } from './ActionItem';
import type { MoodEntry } from './MoodEntry';
import type { Note } from './Note';
import type { ShareToken } from './sharing';
import type { TeamMember } from './TeamMember';

export interface AppData {
  members: TeamMember[];
  notes: Note[];
  actionItems: ActionItem[];
  moods: MoodEntry[];
  settings: Record<string, string>;
  /** Notes the manager explicitly shared; every other note is in the private envelope. */
  sharedNotes?: Note[];
  /** The links the manager has made; see shareStore. */
  shareTokens?: ShareToken[];
}
