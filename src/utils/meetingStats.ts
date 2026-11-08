import { EMPTY_SESSION_NOTE } from '../data/notes';
import type {
  GapAlertData,
  MeetingStats,
  MeetingTimelineEntry,
  WeeklyFrequency,
} from '../types/meeting';
import type { Note } from '../types/Note';
import type { TeamMember } from '../types/TeamMember';
import { daysBetween, getCadenceDays, isGapOverdue, summarizeNote } from './prepData';
import { toIsoDate } from './scheduleCalculator';

export const TIMELINE_PREVIEW_LENGTH = 80;
export const FREQUENCY_WEEKS = 12;

const DAYS_PER_WEEK = 7;
const WEEKS_FROM_DAYS_AT = 14;

interface Meeting {
  note: Note;
  at: Date;
}

/** One meeting per note, newest first. Notes with an unreadable timestamp are left out. */
function toMeetings(notes: readonly Note[]): Meeting[] {
  return notes
    .map((note) => ({ note, at: new Date(note.createdAt) }))
    .filter(({ at }) => !Number.isNaN(at.getTime()))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function computeMeetingStats(notes: readonly Note[], now: Date = new Date()): MeetingStats {
  const meetings = toMeetings(notes);
  const daysAgo = meetings.map(({ at }) => daysBetween(at, now));
  let avgFrequencyDays: number | null = null;
  if (meetings.length > 1) {
    const span = daysBetween(meetings[meetings.length - 1].at, meetings[0].at);
    // Meetings that all fall on one day say nothing about how often they happen.
    if (span > 0) avgFrequencyDays = Math.max(1, Math.round(span / (meetings.length - 1)));
  }
  return {
    totalMeetings: meetings.length,
    last30Days: daysAgo.filter((days) => days < 30).length,
    last90Days: daysAgo.filter((days) => days < 90).length,
    avgFrequencyDays,
  };
}

/** Newest first. The preview is cut at a word boundary, so it never ends halfway through a word. */
export function buildMeetingTimeline(notes: readonly Note[]): MeetingTimelineEntry[] {
  return toMeetings(notes).map(({ note }) => ({
    id: note.id,
    date: note.createdAt,
    notePreview: summarizeNote(note.content, TIMELINE_PREVIEW_LENGTH) ?? EMPTY_SESSION_NOTE,
  }));
}

const startOfWeek = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));

/** Meetings per Monday-to-Sunday week for the last twelve weeks, oldest first, ending this week. */
export function computeWeeklyFrequency(
  notes: readonly Note[],
  now: Date = new Date(),
): WeeklyFrequency[] {
  const thisWeek = startOfWeek(now);
  const weeks = Array.from({ length: FREQUENCY_WEEKS }, (_, index): WeeklyFrequency => {
    const start = new Date(
      thisWeek.getFullYear(),
      thisWeek.getMonth(),
      thisWeek.getDate() - (FREQUENCY_WEEKS - 1 - index) * DAYS_PER_WEEK,
    );
    return { weekStart: toIsoDate(start), weekLabel: `W${index + 1}`, count: 0 };
  });
  for (const { at } of toMeetings(notes)) {
    const weeksAgo = Math.floor(daysBetween(startOfWeek(at), thisWeek) / DAYS_PER_WEEK);
    const index = FREQUENCY_WEEKS - 1 - weeksAgo;
    if (at.getTime() <= now.getTime() && index >= 0) weeks[index].count += 1;
  }
  return weeks;
}

/** Null without a schedule to measure against or a first meeting to count from. */
export function computeGapAlert(
  member: TeamMember,
  lastMetAt: string | undefined,
  now: Date = new Date(),
): GapAlertData | null {
  const cadenceDays = getCadenceDays(member.schedule);
  const lastMet = lastMetAt ? new Date(lastMetAt) : null;
  if (cadenceDays === null || lastMet === null || Number.isNaN(lastMet.getTime())) return null;
  const daysSinceLastMeeting = daysBetween(lastMet, now);
  return {
    engineerId: member.id,
    engineerName: member.name,
    daysSinceLastMeeting,
    cadenceDays,
    isOverdue: isGapOverdue(daysSinceLastMeeting, cadenceDays),
  };
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** "5 days" up to a fortnight, then whole weeks ("3 weeks"). */
export function formatGapDuration(days: number): string {
  return days < WEEKS_FROM_DAYS_AT
    ? plural(days, 'day')
    : plural(Math.floor(days / DAYS_PER_WEEK), 'week');
}

export function formatAvgFrequency(days: number | null): string {
  if (days === null || !Number.isFinite(days)) return 'N/A';
  return days <= 1 ? 'Every day' : `Every ${days} days`;
}
