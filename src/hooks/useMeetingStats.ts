import { useEffect, useMemo } from 'react';
import { listMembers } from '../data/members';
import { listNotes } from '../data/notes';
import type { Note } from '../types/Note';
import type {
  GapAlertData,
  MeetingStats,
  MeetingTimelineEntry,
  WeeklyFrequency,
} from '../types/meeting';
import {
  buildMeetingTimeline,
  computeGapAlert,
  computeMeetingStats,
  computeWeeklyFrequency,
} from '../utils/meetingStats';
import { useEncryptedStorage } from './useEncryptedStorage';

export interface MeetingHistory {
  stats: MeetingStats;
  timeline: MeetingTimelineEntry[];
  frequency: WeeklyFrequency[];
}

/** Notes live in the private envelope, so it is opened here; failures leave the results empty. */
function usePrivateStorage() {
  const storage = useEncryptedStorage();
  const { isPrivateUnlocked, loadPrivate } = storage;

  useEffect(() => {
    if (!isPrivateUnlocked) loadPrivate().catch(() => undefined);
  }, [isPrivateUnlocked, loadPrivate]);

  return storage;
}

/**
 * Meeting stats, history and weekly frequency for one person, read from the decrypted in-memory
 * notes on every change and never stored or cached elsewhere. Everything is empty until the notes
 * are open, and when there are none.
 */
export function useMeetingStats(engineerId: string): MeetingHistory {
  const storage = usePrivateStorage();
  const { isPrivateUnlocked } = storage;

  // `storage` is a new value after every write, so this follows notes added while it is on screen.
  return useMemo(() => {
    let notes: Note[] = [];
    if (isPrivateUnlocked) {
      try {
        notes = listNotes(engineerId, storage);
      } catch {
        notes = [];
      }
    }
    const now = new Date();
    return {
      stats: computeMeetingStats(notes, now),
      timeline: buildMeetingTimeline(notes),
      frequency: computeWeeklyFrequency(notes, now),
    };
  }, [engineerId, isPrivateUnlocked, storage]);
}

/**
 * Everyone whose last 1:1 is more than 1.5 times their usual cadence ago, most overdue first.
 * People without a schedule, or who have never been met, have nothing to measure against and are
 * left out. Never logs names or durations.
 */
export function useGapAlerts(): GapAlertData[] {
  const storage = usePrivateStorage();
  const { isPrivateUnlocked } = storage;

  return useMemo(() => {
    if (!isPrivateUnlocked) return [];
    try {
      const now = new Date();
      return listMembers(storage)
        .flatMap((member) => {
          const [latest] = listNotes(member.id, storage);
          const alert = computeGapAlert(member, latest?.createdAt, now);
          return alert?.isOverdue ? [alert] : [];
        })
        .sort(
          (a, b) =>
            b.daysSinceLastMeeting - b.cadenceDays - (a.daysSinceLastMeeting - a.cadenceDays) ||
            a.engineerName.localeCompare(b.engineerName, undefined, { sensitivity: 'base' }),
        );
    } catch {
      return [];
    }
  }, [isPrivateUnlocked, storage]);
}
