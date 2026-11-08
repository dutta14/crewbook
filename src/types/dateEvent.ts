export type DateEventType = 'visa_expiry' | 'probation_end' | 'anniversary' | 'birthday';

/** The types a manager enters by hand. An anniversary is always derived from the start date. */
export type StoredDateEventType = Exclude<DateEventType, 'anniversary'>;

/** One date about one person. A missing date means the field is "Not set". */
export interface DateEvent {
  engineerId: string;
  type: DateEventType;
  /** Calendar day, YYYY-MM-DD. */
  date?: string;
}

/** How many days ahead of each event its reminder starts showing. */
export interface LeadTimeConfig {
  visa_expiry: number;
  probation_end: number;
  anniversary: number;
  birthday: number;
}

/** A reminder worked out from a date event. It is built when needed and never stored. */
export interface DateReminderData {
  engineerId: string;
  engineerName: string;
  type: DateEventType;
  /** Calendar day the event falls on (the next occurrence, for anniversaries and birthdays). */
  eventDate: string;
  /** Whole calendar days from today; 0 is today. */
  daysUntil: number;
  /** Years of tenure the anniversary marks. Only set for anniversaries. */
  tenureYears?: number;
  /** Only birthdays and anniversaries get one; visa and probation dates never do. */
  conversationStarter?: string;
}
