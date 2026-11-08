import { describe, expect, it, vi } from 'vitest';
import { createMember, createReminder as buildReminder } from '../test-utils/factories';
import { StorageWriteError } from '../utils/encryptedStorage';
import { NotFoundError, ValidationError } from './errors';
import {
  REMINDER_TEXT_MAX_LENGTH,
  createReminder,
  deleteRemindersForMember,
  dismissReminder,
  getDueReminders,
  getNextOneOnOneDate,
  getReminders,
  isReminderDue,
  isReminderSnoozed,
  isSnoozeOption,
  isTriggerType,
  snoozeReminder,
  type ReminderStorage,
} from './reminders';

// Monday 15 June 2026.
const NOW = new Date(2026, 5, 15, 12);
const ALEX = createMember({
  id: 'alex',
  name: 'Alex Chen',
  schedule: { cadence: 'weekly', dayOfWeek: 'thursday', time: '10:00', nextDate: '2026-06-18' },
});
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

function createStorage(
  privateData: Record<string, unknown> = {},
  failure: StorageWriteError | null = null,
  members = [ALEX, PRIYA],
) {
  const data = new Map<string, unknown>(Object.entries(privateData));
  const publicData = new Map<string, unknown>([['members', members]]);
  const flush = vi.fn(async () => failure);
  const storage: ReminderStorage = {
    get: <T>(key: string) => (publicData.has(key) ? (publicData.get(key) as T) : null),
    set: <T>(key: string, value: T) => void publicData.set(key, value),
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, flush };
}

describe('createReminder', () => {
  it('stores a trimmed reminder in the private envelope and forces the write', async () => {
    const { storage, data, flush } = createStorage();

    const reminder = await createReminder(
      { text: '  Ask about on-call  ', linkedPersonId: 'alex', triggerType: 'next_1on1' },
      storage,
      NOW,
    );

    expect(reminder).toMatchObject({
      text: 'Ask about on-call',
      linkedPersonId: 'alex',
      linkedPersonName: 'Alex Chen',
      triggerType: 'next_1on1',
      status: 'active',
    });
    expect(reminder.triggerDate).toBeUndefined();
    expect(data.get('reminders')).toEqual([reminder]);
    expect(flush).toHaveBeenCalledOnce();
  });

  it('keeps the date for a specific-date reminder and allows today', async () => {
    const { storage } = createStorage();

    const reminder = await createReminder(
      {
        text: 'Congratulate',
        linkedPersonId: 'alex',
        triggerType: 'specific_date',
        triggerDate: '2026-06-15',
      },
      storage,
      NOW,
    );

    expect(reminder.triggerDate).toBe('2026-06-15');
  });

  it('drops a date that is sent with a next 1:1 trigger', async () => {
    const { storage } = createStorage();

    const reminder = await createReminder(
      {
        text: 'Check in',
        linkedPersonId: 'alex',
        triggerType: 'next_1on1',
        triggerDate: '2026-07-01',
      },
      storage,
      NOW,
    );

    expect(reminder.triggerDate).toBeUndefined();
  });

  it.each([
    ['empty text', { text: '   ' }],
    ['text over the limit', { text: 'a'.repeat(REMINDER_TEXT_MAX_LENGTH + 1) }],
    ['a person who is not on the team', { linkedPersonId: 'ghost' }],
    ['an unknown trigger', { triggerType: 'whenever' as never }],
    ['a date trigger without a date', { triggerType: 'specific_date' as const }],
    [
      'a date that does not exist',
      { triggerType: 'specific_date' as const, triggerDate: '2026-02-31' },
    ],
    ['a date in the past', { triggerType: 'specific_date' as const, triggerDate: '2026-06-14' }],
  ])('rejects %s without touching storage', async (_name, override) => {
    const { storage, data, flush } = createStorage();

    await expect(
      createReminder(
        { text: 'Hello', linkedPersonId: 'alex', triggerType: 'next_1on1', ...override },
        storage,
        NOW,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(data.has('reminders')).toBe(false);
    expect(flush).not.toHaveBeenCalled();
  });

  it('never repeats the reminder text in a validation message', async () => {
    const { storage } = createStorage();
    const text = 'x'.repeat(REMINDER_TEXT_MAX_LENGTH + 1);

    const error = await createReminder(
      { text, linkedPersonId: 'alex', triggerType: 'next_1on1' },
      storage,
      NOW,
    ).catch((caught: Error) => caught);

    expect((error as Error).message).not.toContain(text);
  });

  it('rolls back and rethrows when the encrypted write fails', async () => {
    const failure = new StorageWriteError(false, true);
    const { storage, data } = createStorage({ reminders: [] }, failure);

    await expect(
      createReminder({ text: 'Nope', linkedPersonId: 'alex', triggerType: 'next_1on1' }, storage),
    ).rejects.toBe(failure);
    expect(data.get('reminders')).toEqual([]);
  });

  it('serialises back-to-back writes so none is lost', async () => {
    const { storage } = createStorage();
    const input = { linkedPersonId: 'alex', triggerType: 'next_1on1' as const };

    await Promise.all([
      createReminder({ ...input, text: 'One' }, storage, NOW),
      createReminder({ ...input, text: 'Two' }, storage, NOW),
    ]);

    expect(getReminders(storage).map((item) => item.text)).toEqual(['One', 'Two']);
  });
});

describe('dismissReminder', () => {
  it('marks it dismissed, stamps the time and clears a snooze', async () => {
    const reminder = buildReminder({
      linkedPersonId: 'alex',
      status: 'snoozed',
      snoozedUntil: '2026-06-22',
    });
    const { storage } = createStorage({ reminders: [reminder] });

    const dismissed = await dismissReminder(reminder.id, storage, NOW);

    expect(dismissed).toMatchObject({ status: 'dismissed', dismissedAt: NOW.toISOString() });
    expect(dismissed.snoozedUntil).toBeUndefined();
    expect(getReminders(storage)).toEqual([dismissed]);
  });

  it('rejects an unknown id', async () => {
    const { storage } = createStorage({ reminders: [] });

    await expect(dismissReminder('missing', storage)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('restores the reminder when the write fails', async () => {
    const reminder = buildReminder({ linkedPersonId: 'alex' });
    const failure = new StorageWriteError(false, true);
    const { storage, data } = createStorage({ reminders: [reminder] }, failure);

    await expect(dismissReminder(reminder.id, storage)).rejects.toBe(failure);
    expect(data.get('reminders')).toEqual([reminder]);
  });
});

describe('snoozeReminder', () => {
  const stored = (overrides = {}) =>
    buildReminder({ id: 'r1', linkedPersonId: 'alex', ...overrides });

  it('snoozes for one day', async () => {
    const { storage } = createStorage({ reminders: [stored()] });

    const { reminder, usedFallback } = await snoozeReminder('r1', '1_day', storage, NOW);

    expect(reminder).toMatchObject({ status: 'snoozed', snoozedUntil: '2026-06-16' });
    expect(usedFallback).toBe(false);
  });

  it('snoozes for one week', async () => {
    const { storage } = createStorage({ reminders: [stored()] });

    const { reminder } = await snoozeReminder('r1', '1_week', storage, NOW);

    expect(reminder.snoozedUntil).toBe('2026-06-22');
  });

  it('snoozes until the next scheduled 1:1 and turns a date reminder into a 1:1 one', async () => {
    const { storage } = createStorage({
      reminders: [stored({ triggerType: 'specific_date', triggerDate: '2026-06-15' })],
    });

    const { reminder, usedFallback } = await snoozeReminder('r1', 'next_1on1', storage, NOW);

    expect(reminder).toMatchObject({
      triggerType: 'next_1on1',
      status: 'snoozed',
      snoozedUntil: '2026-06-18',
    });
    expect(reminder.triggerDate).toBeUndefined();
    expect(usedFallback).toBe(false);
  });

  it('falls back to a week and says so when no 1:1 is scheduled', async () => {
    const { storage } = createStorage({
      reminders: [stored({ linkedPersonId: 'priya' })],
    });

    const { reminder, usedFallback } = await snoozeReminder('r1', 'next_1on1', storage, NOW);

    expect(reminder.snoozedUntil).toBe('2026-06-22');
    expect(usedFallback).toBe(true);
  });

  it('rejects an option that is not offered', async () => {
    const { storage } = createStorage({ reminders: [stored()] });

    await expect(snoozeReminder('r1', '1_hour' as never, storage)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('restores the reminder when the write fails', async () => {
    const reminder = stored();
    const failure = new StorageWriteError(false, true);
    const { storage, data } = createStorage({ reminders: [reminder] }, failure);

    await expect(snoozeReminder('r1', '1_day', storage, NOW)).rejects.toBe(failure);
    expect(data.get('reminders')).toEqual([reminder]);
  });
});

describe('getNextOneOnOneDate', () => {
  it('uses the scheduled date when it is after today', () => {
    expect(getNextOneOnOneDate(ALEX, NOW)).toBe('2026-06-18');
  });

  it('moves on to the following 1:1 when the scheduled one is today', () => {
    const today = { ...ALEX, schedule: { ...ALEX.schedule!, nextDate: '2026-06-15' } };

    expect(getNextOneOnOneDate(today, NOW)).toBe('2026-06-18');
  });

  it('returns null without a usable schedule', () => {
    expect(getNextOneOnOneDate(null, NOW)).toBeNull();
    expect(getNextOneOnOneDate(PRIYA, NOW)).toBeNull();
    const broken = { ...ALEX, schedule: { ...ALEX.schedule!, nextDate: 'soon' } };
    expect(getNextOneOnOneDate(broken, NOW)).toBeNull();
  });
});

describe('due reminders', () => {
  const upcoming = buildReminder({ id: 'a', linkedPersonId: 'alex' });
  const today = buildReminder({
    id: 'b',
    linkedPersonId: 'priya',
    triggerType: 'specific_date',
    triggerDate: '2026-06-15',
  });
  const missed = buildReminder({
    id: 'c',
    linkedPersonId: 'alex',
    triggerType: 'specific_date',
    triggerDate: '2026-06-10',
  });
  const later = buildReminder({
    id: 'd',
    linkedPersonId: 'alex',
    triggerType: 'specific_date',
    triggerDate: '2026-06-20',
  });
  const dismissed = buildReminder({ id: 'e', linkedPersonId: 'alex', status: 'dismissed' });
  const snoozed = buildReminder({
    id: 'f',
    linkedPersonId: 'alex',
    status: 'snoozed',
    snoozedUntil: '2026-06-16',
  });
  const wokenUp = buildReminder({
    id: 'g',
    linkedPersonId: 'alex',
    status: 'snoozed',
    snoozedUntil: '2026-06-15',
  });
  const all = [upcoming, today, missed, later, dismissed, snoozed, wokenUp];

  it('lists next 1:1 reminders for prep, leaving out dismissed and snoozed ones', () => {
    const { storage } = createStorage({ reminders: all });

    const ids = getDueReminders(storage, 'alex', '1on1_prep', NOW).map((item) => item.id);

    expect(ids).toEqual(['a', 'g']);
  });

  it('lists date reminders from their day on the dashboard, oldest first', () => {
    const { storage } = createStorage({ reminders: all });

    const ids = getDueReminders(storage, undefined, 'dashboard', NOW).map((item) => item.id);

    expect(ids).toEqual(['c', 'b']);
  });

  it('limits the list to one person', () => {
    const { storage } = createStorage({ reminders: all });

    expect(getDueReminders(storage, 'priya', 'dashboard', NOW).map((item) => item.id)).toEqual([
      'b',
    ]);
  });

  it('treats a snooze as running until its day arrives', () => {
    expect(isReminderSnoozed(snoozed, NOW)).toBe(true);
    expect(isReminderSnoozed(wokenUp, NOW)).toBe(false);
    expect(isReminderSnoozed(dismissed, NOW)).toBe(false);
    expect(isReminderDue(snoozed, '1on1_prep', NOW)).toBe(false);
  });

  it('ignores stored entries that are not reminders', () => {
    const { storage } = createStorage({ reminders: [upcoming, { id: 1 }, 'text', null] });

    expect(getReminders(storage)).toEqual([upcoming]);
  });

  it('returns nothing when nothing is stored', () => {
    expect(getReminders(createStorage().storage)).toEqual([]);
  });

  it('does not log what it reads', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { storage } = createStorage({ reminders: all });

    getDueReminders(storage, 'alex', '1on1_prep', NOW);

    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('deleteRemindersForMember', () => {
  it('removes only that person’s reminders and forces the write', async () => {
    const mine = buildReminder({ linkedPersonId: 'alex' });
    const theirs = buildReminder({ linkedPersonId: 'priya' });
    const { storage, flush } = createStorage({ reminders: [mine, theirs] });

    await deleteRemindersForMember('alex', storage);

    expect(getReminders(storage)).toEqual([theirs]);
    expect(flush).toHaveBeenCalledOnce();
  });
});

describe('guards', () => {
  it('recognise the values the form can send', () => {
    expect(isTriggerType('specific_date')).toBe(true);
    expect(isTriggerType('daily')).toBe(false);
    expect(isSnoozeOption('1_week')).toBe(true);
    expect(isSnoozeOption(7)).toBe(false);
  });
});
