import { EMPTY_SESSION_NOTE } from '../data/notes';
import { isTeamMemberStatus } from '../data/members';
import type { ActionItem } from '../types/ActionItem';
import type { Note } from '../types/Note';
import type { PrepData, PrepStatusChange } from '../types/prep';
import type { Schedule } from '../types/Schedule';
import type { TeamMember } from '../types/TeamMember';
import { isValidInterval } from './scheduleCalculator';

export const SUMMARY_MAX_LENGTH = 100;
export const OVERDUE_FACTOR = 1.5;

const ELLIPSIS = '…';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const CADENCE_DAYS = { weekly: 7, biweekly: 14, monthly: 30 } as const;

/** The usual gap between 1:1s, or null when no schedule is set. */
export function getCadenceDays(schedule: Schedule | undefined): number | null {
  if (!schedule) return null;
  if (schedule.cadence === 'custom') {
    return isValidInterval(schedule.customIntervalDays) ? schedule.customIntervalDays : 7;
  }
  return Object.hasOwn(CADENCE_DAYS, schedule.cadence) ? CADENCE_DAYS[schedule.cadence] : null;
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Whole calendar days from `from` to `to`, never below zero. Rounds so daylight saving is harmless. */
export function daysBetween(from: Date, to: Date): number {
  const days = Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
  return Math.max(0, days);
}

/**
 * The first 100 characters of a note on one line. Long notes are cut at a word boundary, so a
 * fragment cannot end halfway through a word, and end with an ellipsis that counts toward the limit.
 */
export function summarizeNote(content: string): string | null {
  const text = content.replace(/\s+/g, ' ').trim();
  if (text === '' || text === EMPTY_SESSION_NOTE) return null;
  if (text.length <= SUMMARY_MAX_LENGTH) return text;
  const limit = SUMMARY_MAX_LENGTH - ELLIPSIS.length;
  // A space at `limit` means the cut already falls between words.
  const lastSpace = text.lastIndexOf(' ', limit);
  const cut = lastSpace > 0 ? lastSpace : limit;
  return `${text.slice(0, cut).trimEnd()}${ELLIPSIS}`;
}

function recentStatusChanges(member: TeamMember, lastMeetingAt: number, now: Date) {
  const history = Array.isArray(member.history) ? member.history : [];
  const changes: PrepStatusChange[] = [];
  for (const change of history) {
    if (change.field !== 'status' || !isTeamMemberStatus(change.to)) continue;
    const changedAt = Date.parse(change.date);
    if (Number.isNaN(changedAt) || changedAt <= lastMeetingAt || changedAt > now.getTime())
      continue;
    changes.push({
      status: change.to,
      changedAt: change.date,
      daysAgo: daysBetween(new Date(changedAt), now),
    });
  }
  return changes.sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt));
}

interface PrepSources {
  member: TeamMember;
  /** The member's notes, newest first. */
  notes: Note[];
  /** The member's open action items. */
  openActionItems: ActionItem[];
  now: Date;
}

/** Null when there has been no earlier 1:1 to prepare from. */
export function buildPrepData({
  member,
  notes,
  openActionItems,
  now,
}: PrepSources): PrepData | null {
  const [lastNote] = notes;
  if (!lastNote) return null;
  const lastMeetingAt = Date.parse(lastNote.createdAt);
  if (Number.isNaN(lastMeetingAt)) return null;
  const daysSinceLastMeeting = daysBetween(new Date(lastMeetingAt), now);
  const cadenceDays = getCadenceDays(member.schedule);
  return {
    daysSinceLastMeeting,
    cadenceDays,
    isOverdue: cadenceDays !== null && daysSinceLastMeeting > cadenceDays * OVERDUE_FACTOR,
    openActionItems: openActionItems.map(({ id, title }) => ({ id, title })),
    lastDiscussedSummary: summarizeNote(lastNote.content),
    recentStatusChanges: recentStatusChanges(member, lastMeetingAt, now),
  };
}
