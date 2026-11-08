import { describe, expect, it } from 'vitest';
import { createActionItem, createMember, createNote } from '../test-utils/factories';
import {
  SUMMARY_MAX_LENGTH,
  buildPrepData,
  daysBetween,
  getCadenceDays,
  summarizeNote,
} from './prepData';

const NOW = new Date(2025, 5, 20, 15, 0);
const at = (day: number, hour = 9) => new Date(2025, 5, day, hour, 0).toISOString();

describe('getCadenceDays', () => {
  it.each([
    ['weekly', undefined, 7],
    ['biweekly', undefined, 14],
    ['monthly', undefined, 30],
    ['custom', 10, 10],
    ['custom', undefined, 7],
  ] as const)('maps %s (%s) to %i days', (cadence, customIntervalDays, expected) => {
    const schedule = {
      cadence,
      customIntervalDays,
      dayOfWeek: 'monday',
      time: '10:00',
      nextDate: '2025-06-23',
    } as const;
    expect(getCadenceDays(schedule)).toBe(expected);
  });

  it('is null without a schedule', () => {
    expect(getCadenceDays(undefined)).toBeNull();
  });
});

describe('daysBetween', () => {
  it('counts calendar days, not 24-hour periods', () => {
    expect(daysBetween(new Date(2025, 5, 19, 23, 0), new Date(2025, 5, 20, 1, 0))).toBe(1);
  });

  it('stays correct across a daylight saving change', () => {
    expect(daysBetween(new Date(2025, 2, 5), new Date(2025, 2, 12))).toBe(7);
  });

  it('never goes below zero', () => {
    expect(daysBetween(new Date(2025, 5, 21), new Date(2025, 5, 20))).toBe(0);
  });
});

describe('summarizeNote', () => {
  it('returns short notes as they are', () => {
    expect(summarizeNote('Talked about launch')).toBe('Talked about launch');
  });

  it('puts a multi-line note on one line', () => {
    expect(summarizeNote('First line\n\nSecond   line')).toBe('First line Second line');
  });

  it('returns null for an empty or placeholder note', () => {
    expect(summarizeNote('   \n ')).toBeNull();
    expect(summarizeNote('(No notes)')).toBeNull();
  });

  it('cuts at a word boundary within 100 characters, ellipsis included', () => {
    const summary = summarizeNote('alpha '.repeat(30)) as string;

    expect(summary.length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
    expect(summary.endsWith('alpha…')).toBe(true);
  });

  it('cuts mid-word only when there is no space to cut at', () => {
    const summary = summarizeNote('x'.repeat(300)) as string;

    expect(summary).toBe(`${'x'.repeat(SUMMARY_MAX_LENGTH - 1)}…`);
  });

  it('keeps a note of exactly 100 characters whole', () => {
    const exact = 'y'.repeat(SUMMARY_MAX_LENGTH);

    expect(summarizeNote(exact)).toBe(exact);
  });
});

describe('buildPrepData', () => {
  const member = createMember({
    schedule: { cadence: 'weekly', dayOfWeek: 'monday', time: '10:00', nextDate: '2025-06-23' },
  });

  it('is null without any earlier note', () => {
    expect(buildPrepData({ member, notes: [], openActionItems: [], now: NOW })).toBeNull();
  });

  it('is null when the last note has an unreadable date', () => {
    const notes = [createNote({ createdAt: 'not a date' })];

    expect(buildPrepData({ member, notes, openActionItems: [], now: NOW })).toBeNull();
  });

  it('measures days since the newest note against 1.5 times the cadence', () => {
    const notes = [createNote({ createdAt: at(9) })];

    const data = buildPrepData({ member, notes, openActionItems: [], now: NOW });

    expect(data).toMatchObject({ daysSinceLastMeeting: 11, cadenceDays: 7, isOverdue: true });
  });

  it('is not overdue at exactly 1.5 times the cadence', () => {
    const notes = [createNote({ createdAt: new Date(2025, 5, 10).toISOString() })];

    expect(buildPrepData({ member, notes, openActionItems: [], now: NOW })?.isOverdue).toBe(false);
  });

  it('is never overdue without a schedule', () => {
    const unscheduled = createMember();
    const notes = [createNote({ createdAt: at(1) })];

    const data = buildPrepData({ member: unscheduled, notes, openActionItems: [], now: NOW });

    expect(data).toMatchObject({ cadenceDays: null, isOverdue: false });
  });

  it('keeps only the id and title of each open action item', () => {
    const items = [createActionItem({ id: 'a1', title: 'Send plan', ownerName: 'Me' })];

    const data = buildPrepData({
      member,
      notes: [createNote({ createdAt: at(19) })],
      openActionItems: items,
      now: NOW,
    });

    expect(data?.openActionItems).toEqual([{ id: 'a1', title: 'Send plan' }]);
  });

  it('collects status changes since the last 1:1, newest first, and skips unusable ones', () => {
    const withHistory = createMember({
      history: [
        { id: '1', date: at(5), field: 'status', from: 'active', to: 'on_leave' },
        { id: '2', date: at(15), field: 'status', from: 'on_leave', to: 'active' },
        { id: '3', date: at(17), field: 'status', from: 'active', to: 'departing' },
        { id: '4', date: at(18), field: 'role', to: 'Lead' },
        { id: '5', date: at(18), field: 'status', from: 'active', to: 'bogus' },
        { id: '6', date: 'nope', field: 'status', from: 'active', to: 'departing' },
        { id: '7', date: at(25), field: 'status', from: 'active', to: 'departing' },
      ],
    });

    const data = buildPrepData({
      member: withHistory,
      notes: [createNote({ createdAt: at(10) })],
      openActionItems: [],
      now: NOW,
    });

    expect(data?.recentStatusChanges).toEqual([
      { status: 'departing', changedAt: at(17), daysAgo: 3 },
      { status: 'active', changedAt: at(15), daysAgo: 5 },
    ]);
  });
});
