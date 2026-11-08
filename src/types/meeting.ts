/** Every figure here is derived on render from the member's notes and never stored. */
export interface MeetingStats {
  totalMeetings: number;
  last30Days: number;
  last90Days: number;
  /** Average whole days between meetings; null until there are two meetings to measure. */
  avgFrequencyDays: number | null;
}

export interface GapAlertData {
  engineerId: string;
  engineerName: string;
  daysSinceLastMeeting: number;
  cadenceDays: number;
  /** True once daysSinceLastMeeting is more than 1.5 times cadenceDays. */
  isOverdue: boolean;
}

export interface MeetingTimelineEntry {
  /** The id of the note that records the meeting. */
  id: string;
  /** ISO 8601 moment the note was written. */
  date: string;
  /** The start of the note, cut at a word boundary. */
  notePreview: string;
}

export interface WeeklyFrequency {
  /** The Monday that starts the week, as YYYY-MM-DD. */
  weekStart: string;
  /** "W1" is the oldest of the twelve weeks. */
  weekLabel: string;
  count: number;
}
