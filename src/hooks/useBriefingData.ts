import { useMemo } from 'react';
import { listAll } from '../data/actionItems';
import { leaveCoversDay, leaveOverlapsRange, LEAVE_TYPE_LABELS } from '../data/leave';
import { listMembers } from '../data/members';
import { listNotes } from '../data/notes';
import { sortTodos } from '../data/todos';
import type {
  BriefingCelebration,
  BriefingData,
  BriefingLeave,
  BriefingWhosOut,
} from '../types/briefing';
import type { DateReminderData } from '../types/dateEvent';
import type { SnoozeOption } from '../types/reminder';
import type { TeamMember } from '../types/TeamMember';
import { formatBriefingDate, getGreeting } from '../utils/briefingFormat';
import { getWeekDays } from '../utils/calendarDates';
import { isSensitiveDateEvent } from '../utils/dateEventFormat';
import {
  getNextUpcoming,
  getTodaysOneOnes,
  toIsoDate,
  type DigestContext,
} from '../utils/scheduleCalculator';
import { formatUpcomingDay } from '../utils/scheduleFormat';
import { formatStartDate } from '../utils/startDate';
import { useDateReminders } from './useDateEvents';
import { useEncryptedStorage } from './useEncryptedStorage';
import { useLeave } from './useLeave';
import { useGapAlerts } from './useMeetingStats';
import { usePrivateEnvelope } from './usePrivateEnvelope';
import { useReminders } from './useReminders';
import { useTodos } from './useTodos';

export interface UseBriefingData extends BriefingData {
  /** False until the private envelope has been opened. */
  isReady: boolean;
  loadFailed: boolean;
  /** Used for avatar images only. */
  members: TeamMember[];
  actions: {
    toggleTodo: (id: string) => Promise<void>;
    dismissReminder: (id: string) => Promise<void>;
    snoozeReminder: (id: string, option: SnoozeOption) => Promise<void>;
  };
}

function toCelebration(reminder: DateReminderData): BriefingCelebration {
  const { engineerId, engineerName, type, tenureYears, eventDate, daysUntil, conversationStarter } =
    reminder;
  const date = formatStartDate(eventDate);
  return {
    engineerId,
    name: engineerName,
    eventType: type === 'anniversary' ? 'anniversary' : 'birthday',
    eventLabel: type === 'anniversary' ? `${tenureYears}-year anniversary` : 'Birthday',
    timing: daysUntil === 0 || !date ? 'Today' : `On ${date}`,
    ...(conversationStarter ? { conversationStarter } : {}),
  };
}

/**
 * Gathers everything for the morning briefing. Each source is read once per change, from decrypted
 * in-memory data, and the result is never written anywhere. Pass `now` to fix the clock in tests.
 */
export function useBriefingData(now?: Date): UseBriefingData {
  const clock = useMemo(() => now ?? new Date(), [now]);
  const storage = useEncryptedStorage();
  const { isReady, loadFailed } = usePrivateEnvelope();
  const { due, dismissReminder, snoozeReminder } = useReminders({
    context: 'dashboard',
    now: clock,
  });
  const dateReminders = useDateReminders(clock);
  const overdueMeetings = useGapAlerts();
  const { todos, toggleStatus } = useTodos();
  const { entries: leave } = useLeave();

  const members = useMemo(() => listMembers(storage), [storage]);
  const isoDate = toIsoDate(clock);

  const { todaysMeetings, nextMeeting } = useMemo(() => {
    if (!isReady) return { todaysMeetings: [], nextMeeting: null };
    const openActionItems = new Map<string, number>();
    for (const item of listAll(storage, 'open')) {
      openActionItems.set(item.memberId, (openActionItems.get(item.memberId) ?? 0) + 1);
    }
    const lastMetDates = new Map<string, string>();
    for (const member of members) {
      const [latest] = listNotes(member.id, storage);
      if (latest) lastMetDates.set(member.id, latest.createdAt);
    }
    const context: DigestContext = { openActionItems, lastMetDates, now: clock };
    const entries = getTodaysOneOnes(members, context).map(({ memberId, ...entry }) => ({
      engineerId: memberId,
      ...entry,
    }));
    return {
      todaysMeetings: entries,
      nextMeeting: entries.length === 0 ? getNextUpcoming(members, clock) : null,
    };
  }, [clock, isReady, members, storage]);

  const dueTodos = useMemo(
    () =>
      sortTodos(
        todos.filter((todo) => todo.dueDate === isoDate),
        'priority',
      ).map(({ id, title, priority, status }) => ({ id, title, priority, status })),
    [isoDate, todos],
  );

  const importantDates = useMemo(
    () => dateReminders.filter((reminder) => isSensitiveDateEvent(reminder.type)),
    [dateReminders],
  );
  const celebrations = useMemo(
    () =>
      dateReminders.filter((reminder) => !isSensitiveDateEvent(reminder.type)).map(toCelebration),
    [dateReminders],
  );

  const onLeave = useMemo<BriefingLeave[]>(() => {
    if (!isReady) return [];
    const names = new Map(members.map((member) => [member.id, member.name]));
    const coveringToday = new Map<string, BriefingLeave>();
    for (const entry of leave) {
      const name = names.get(entry.memberId);
      if (name && leaveCoversDay(entry, isoDate) && !coveringToday.has(entry.memberId)) {
        coveringToday.set(entry.memberId, {
          engineerId: entry.memberId,
          name,
          leaveType: LEAVE_TYPE_LABELS[entry.type],
          leaveKind: entry.type,
        });
      }
    }
    // A member marked "on leave" with no calendar entry still shows, without a type.
    for (const member of members) {
      if (member.status === 'on_leave' && !coveringToday.has(member.id)) {
        coveringToday.set(member.id, {
          engineerId: member.id,
          name: member.name,
          leaveType: 'Away',
        });
      }
    }
    return [...coveringToday.values()];
  }, [isReady, isoDate, leave, members]);

  const whosOut = useMemo<BriefingWhosOut[]>(() => {
    if (!isReady) return [];
    const week = getWeekDays(isoDate);
    const names = new Map(members.map((member) => [member.id, member.name]));
    return leave
      .filter((entry) => names.has(entry.memberId) && leaveOverlapsRange(entry, week[0], week[6]))
      .map((entry) => ({
        id: entry.id,
        engineerId: entry.memberId,
        name: names.get(entry.memberId) ?? '',
        leaveKind: entry.type,
        startDate: entry.startDate,
        endDate: entry.endDate,
      }));
  }, [isReady, isoDate, leave, members]);

  const nextDay = nextMeeting ? formatUpcomingDay(nextMeeting.date, clock) : null;
  const nextMeetingInfo =
    nextMeeting && nextDay ? `Your next 1:1 is with ${nextMeeting.name} on ${nextDay}.` : undefined;

  const sections: BriefingData['sections'] = {
    todaysMeetings,
    overdueMeetings,
    dueTodos,
    dueReminders: due,
    importantDates,
    celebrations,
    onLeave,
    whosOut,
  };
  const isEmpty = Object.values(sections).every((items) => items.length === 0);

  return {
    greeting: getGreeting(clock),
    formattedDate: formatBriefingDate(clock),
    isoDate,
    sections,
    isEmpty,
    ...(nextMeetingInfo ? { nextMeetingInfo } : {}),
    isReady,
    loadFailed,
    members,
    actions: { toggleTodo: toggleStatus, dismissReminder, snoozeReminder },
  };
}
