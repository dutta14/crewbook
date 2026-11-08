import { describe, expect, it } from 'vitest';
import { createMember, createNote } from '../test-utils/factories';
import {
  buildMeetingTimeline,
  computeGapAlert,
  computeMeetingStats,
  computeWeeklyFrequency,
  formatAvgFrequency,
  formatGapDuration,
} from './meetingStats';

// Sunday 8 November 2026. Weeks start on Monday, so this week began on 2 November.
const NOW = new Date(2026, 10, 8, 12, 0);
const daysAgo = (days: number, hour = 9) => new Date(2026, 10, 8 - days, hour).toISOString();
const noteAt = (days: number, content = 'Talked') =>
  createNote({ createdAt: daysAgo(days), content });

describe('computeMeetingStats', () => {
  it('counts total meetings and those inside the last 30 and 90 days', () => {
    const notes = [noteAt(1), noteAt(29), noteAt(30), noteAt(89), noteAt(90), noteAt(200)];

    expect(computeMeetingStats(notes, NOW)).toMatchObject({
      totalMeetings: 6,
      last30Days: 2,
      last90Days: 4,
    });
  });

  it('averages the days between the first and last meeting', () => {
    const stats = computeMeetingStats([noteAt(0), noteAt(7), noteAt(14), noteAt(28)], NOW);

    expect(stats.avgFrequencyDays).toBe(9);
  });

  it('has no average with fewer than two meetings', () => {
    expect(computeMeetingStats([], NOW)).toEqual({
      totalMeetings: 0,
      last30Days: 0,
      last90Days: 0,
      avgFrequencyDays: null,
    });
    expect(computeMeetingStats([noteAt(3)], NOW).avgFrequencyDays).toBeNull();
  });

  it('has no average when every meeting is on the same day', () => {
    const stats = computeMeetingStats([noteAt(2, 'a'), noteAt(2, 'b')], NOW);

    expect(stats.avgFrequencyDays).toBeNull();
  });

  it('ignores notes with an unreadable date', () => {
    const bad = createNote({ createdAt: 'not a date' });

    expect(computeMeetingStats([bad, noteAt(1)], NOW).totalMeetings).toBe(1);
  });
});

describe('buildMeetingTimeline', () => {
  it('orders meetings newest first and keeps the note id', () => {
    const older = noteAt(10, 'Older');
    const newer = noteAt(2, 'Newer');

    const timeline = buildMeetingTimeline([older, newer]);

    expect(timeline.map((entry) => entry.id)).toEqual([newer.id, older.id]);
  });

  it('cuts long notes at a word boundary within 80 characters', () => {
    const content = 'word '.repeat(40);

    const [entry] = buildMeetingTimeline([noteAt(1, content)]);

    expect(entry.notePreview.length).toBeLessThanOrEqual(81);
    expect(entry.notePreview.startsWith('word word')).toBe(true);
    expect(entry.notePreview).not.toMatch(/\bwor$/);
  });

  it('keeps short notes whole', () => {
    expect(buildMeetingTimeline([noteAt(1, 'Short note')])[0].notePreview).toBe('Short note');
  });

  it('uses placeholder text for a note with no content', () => {
    expect(buildMeetingTimeline([noteAt(1, '   ')])[0].notePreview).toBeTruthy();
  });
});

describe('computeWeeklyFrequency', () => {
  it('returns twelve Monday weeks, oldest first, ending with the current week', () => {
    const weeks = computeWeeklyFrequency([], NOW);

    expect(weeks).toHaveLength(12);
    expect(weeks[0]).toMatchObject({ weekStart: '2026-08-17', weekLabel: 'W1', count: 0 });
    expect(weeks[11]).toMatchObject({ weekStart: '2026-11-02', weekLabel: 'W12' });
  });

  it('puts Sunday with the week before and Monday with the week after', () => {
    const sunday = createNote({ createdAt: new Date(2026, 10, 1, 23, 0).toISOString() });
    const monday = createNote({ createdAt: new Date(2026, 10, 2, 0, 30).toISOString() });

    const weeks = computeWeeklyFrequency([sunday, monday], NOW);

    expect(weeks[10].count).toBe(1);
    expect(weeks[11].count).toBe(1);
  });

  it('leaves out meetings older than twelve weeks and those in the future', () => {
    const future = createNote({ createdAt: new Date(2026, 10, 20).toISOString() });

    const weeks = computeWeeklyFrequency([noteAt(100), noteAt(84), future], NOW);

    expect(weeks.reduce((sum, week) => sum + week.count, 0)).toBe(0);
  });

  it('counts several meetings in one week together', () => {
    const weeks = computeWeeklyFrequency([noteAt(0), noteAt(1, 'b'), noteAt(5, 'c')], NOW);

    expect(weeks[11].count).toBe(3);
  });
});

describe('computeGapAlert', () => {
  const member = createMember({
    schedule: { cadence: 'weekly', dayOfWeek: 'monday', time: '10:00', nextDate: '2026-11-09' },
  });

  it('is overdue only beyond one and a half cadences', () => {
    expect(computeGapAlert(member, daysAgo(10), NOW)?.isOverdue).toBe(false);
    expect(computeGapAlert(member, daysAgo(11), NOW)?.isOverdue).toBe(true);
  });

  it('reports the days since the last meeting and the cadence', () => {
    expect(computeGapAlert(member, daysAgo(21), NOW)).toMatchObject({
      engineerId: member.id,
      engineerName: member.name,
      daysSinceLastMeeting: 21,
      cadenceDays: 7,
    });
  });

  it('is null without a schedule or without a last meeting', () => {
    expect(computeGapAlert(createMember(), daysAgo(40), NOW)).toBeNull();
    expect(computeGapAlert(member, undefined, NOW)).toBeNull();
    expect(computeGapAlert(member, 'garbage', NOW)).toBeNull();
  });
});

describe('formatGapDuration', () => {
  it.each([
    [1, '1 day'],
    [13, '13 days'],
    [14, '2 weeks'],
    [21, '3 weeks'],
    [27, '3 weeks'],
  ])('formats %i days as %s', (days, expected) => {
    expect(formatGapDuration(days)).toBe(expected);
  });
});

describe('formatAvgFrequency', () => {
  it.each([
    [null, 'N/A'],
    [Number.NaN, 'N/A'],
    [1, 'Every day'],
    [7, 'Every 7 days'],
  ])('formats %s as %s', (days, expected) => {
    expect(formatAvgFrequency(days)).toBe(expected);
  });
});
