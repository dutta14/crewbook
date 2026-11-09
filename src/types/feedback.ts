export type FeedbackType = 'positive' | 'constructive' | 'neutral';

/** One dated observation about a person. Observations about a report are private to the manager. */
export interface FeedbackEntry {
  /** crypto.randomUUID() */
  id: string;
  engineerId: string;
  /** Calendar day the observation happened, YYYY-MM-DD. */
  date: string;
  type: FeedbackType;
  text: string;
  /** Lower-case, letters, digits and hyphens only. */
  tags: string[];
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

/** What the manager types; everything else is set by the store. */
export type FeedbackInput = Pick<FeedbackEntry, 'engineerId' | 'date' | 'type' | 'text' | 'tags'>;

/** Both ends are inclusive YYYY-MM-DD days; an omitted end is open. */
export interface FeedbackDateRange {
  start?: string;
  end?: string;
}

export interface FeedbackFilter {
  engineerId?: string;
  type?: FeedbackType;
  tag?: string;
  dateRange?: FeedbackDateRange;
  /** Case-insensitive substring match on the text. */
  search?: string;
}
