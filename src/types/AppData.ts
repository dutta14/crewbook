import type { ActionItem } from './ActionItem';
import type { MoodEntry } from './MoodEntry';
import type { Note } from './Note';
import type { TeamMember } from './TeamMember';

export interface AppData {
  members: TeamMember[];
  notes: Note[];
  actionItems: ActionItem[];
  moods: MoodEntry[];
  settings: Record<string, string>;
}
