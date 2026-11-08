import type { DateReminderData } from './dateEvent';
import type { LeaveType } from './leave';
import type { GapAlertData } from './meeting';
import type { Reminder } from './reminder';
import type { Priority, TodoStatus } from './todo';

export interface BriefingMeeting {
  engineerId: string;
  name: string;
  /** "HH:mm" from the schedule. */
  time: string;
  openActionItems: number;
  /** ISO 8601 moment of the latest 1:1 note, or null if there is none. */
  lastMetDate: string | null;
}

export interface BriefingTodo {
  id: string;
  title: string;
  priority: Priority;
  status: TodoStatus;
}

export interface BriefingCelebration {
  engineerId: string;
  name: string;
  eventType: 'birthday' | 'anniversary';
  /** "Birthday" or "2-year anniversary". */
  eventLabel: string;
  /** "Today", or "On Jun 20, 2026" when it is inside the lead time. */
  timing: string;
  conversationStarter?: string;
}

export interface BriefingLeave {
  engineerId: string;
  name: string;
  /** "PTO", "Sick", "Personal" or "Parental"; "Away" when only the member's status says so. */
  leaveType: string;
  /** Picks the badge colour. Absent for "Away". */
  leaveKind?: LeaveType;
}

export interface BriefingWhosOut {
  /** The leave entry. A person with two entries this week appears twice. */
  id: string;
  engineerId: string;
  name: string;
  leaveKind: LeaveType;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
}

/** Everything the dashboard shows, derived from decrypted in-memory data and never stored. */
export interface BriefingData {
  /** "Good morning", "Good afternoon" or "Good evening". */
  greeting: string;
  /** "Tuesday, January 14, 2025" */
  formattedDate: string;
  /** YYYY-MM-DD */
  isoDate: string;
  sections: {
    todaysMeetings: BriefingMeeting[];
    overdueMeetings: GapAlertData[];
    dueTodos: BriefingTodo[];
    dueReminders: Reminder[];
    /** Visa and probation dates, which read generically until the manager asks for details. */
    importantDates: DateReminderData[];
    celebrations: BriefingCelebration[];
    onLeave: BriefingLeave[];
    /** Leave overlapping the Monday to Sunday week that holds today, earliest start first. */
    whosOut: BriefingWhosOut[];
  };
  isEmpty: boolean;
  /** "Your next 1:1 is with Dana on Thursday." Only set when there is no 1:1 today. */
  nextMeetingInfo?: string;
}
