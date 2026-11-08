import { describe, expect, it, vi } from 'vitest';
import { createMember } from '../test-utils/factories';
import { StorageWriteError } from '../utils/encryptedStorage';
import {
  DEFAULT_LEAD_TIMES,
  deleteDateEventsForMember,
  getDateEvents,
  getDueDateReminders,
  getLeadTimeConfig,
  getNextAnniversary,
  getNextBirthday,
  isDateEventType,
  setDateEvent,
  setLeadTimeConfig,
  type DateEventStorage,
} from './dateEvents';
import { ValidationError } from './errors';

// Monday 15 June 2026.
const NOW = new Date(2026, 5, 15, 12);
const ALEX = createMember({ id: 'alex', name: 'Alex Chen', startDate: '2024-03-13' });
const SAM = createMember({ id: 'sam', name: 'Sam Lee', startDate: '2024-06-18' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair', startDate: '2025-01-06' });

function createStorage(
  privateData: Record<string, unknown> = {},
  settings: Record<string, string> = {},
  failure: StorageWriteError | null = null,
  members = [ALEX, PRIYA],
) {
  const data = new Map<string, unknown>(Object.entries(privateData));
  const publicData = new Map<string, unknown>([
    ['members', members],
    ['settings', settings],
  ]);
  const flush = vi.fn(async () => failure);
  const storage: DateEventStorage = {
    get: <T>(key: string) => (publicData.has(key) ? (publicData.get(key) as T) : null),
    set: <T>(key: string, value: T) => void publicData.set(key, value),
    getPrivate: <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    setPrivate: <T>(key: string, value: T) => void data.set(key, value),
    flush,
  };
  return { storage, data, publicData, flush };
}

const event = (engineerId: string, type: string, date: string) => ({ engineerId, type, date });

describe('getNextAnniversary', () => {
  it('counts whole years to the next anniversary', () => {
    expect(getNextAnniversary('2024-06-18', NOW)).toEqual({ date: '2026-06-18', years: 2 });
  });

  it('keeps an anniversary that falls today', () => {
    expect(getNextAnniversary('2024-06-15', NOW)).toMatchObject({
      date: '2026-06-15',
      years: 2,
    });
  });

  it('rolls over to next year once this year has passed', () => {
    expect(getNextAnniversary('2024-03-13', NOW)).toEqual({ date: '2027-03-13', years: 3 });
  });

  it('has no anniversary until the first year is up for someone who starts today or later', () => {
    expect(getNextAnniversary('2026-06-15', NOW)).toEqual({ date: '2027-06-15', years: 1 });
    expect(getNextAnniversary('2026-09-01', NOW)).toEqual({ date: '2027-09-01', years: 1 });
  });

  it('moves 29 February to the 28th in years that are not leap years', () => {
    expect(getNextAnniversary('2020-02-29', new Date(2026, 1, 1))).toEqual({
      date: '2026-02-28',
      years: 6,
    });
    expect(getNextAnniversary('2020-02-29', new Date(2028, 1, 1))).toEqual({
      date: '2028-02-29',
      years: 8,
    });
  });

  it('returns null for a start date that is not a date', () => {
    expect(getNextAnniversary('soon', NOW)).toBeNull();
  });
});

describe('getNextBirthday', () => {
  it('returns today when the birthday is today', () => {
    expect(getNextBirthday('1990-06-15', NOW)).toBe('2026-06-15');
  });

  it('returns next year once it has passed', () => {
    expect(getNextBirthday('1990-06-14', NOW)).toBe('2027-06-14');
  });

  it('returns null for something that is not a date', () => {
    expect(getNextBirthday('nope', NOW)).toBeNull();
  });
});

describe('getDateEvents', () => {
  it('lists the four events in display order, with only the anniversary worked out', () => {
    const { storage } = createStorage({
      dateEvents: [
        event('alex', 'visa_expiry', '2026-07-01'),
        event('priya', 'birthday', '1990-01-01'),
      ],
    });

    expect(getDateEvents('alex', storage, NOW)).toEqual([
      { engineerId: 'alex', type: 'visa_expiry', date: '2026-07-01' },
      { engineerId: 'alex', type: 'probation_end', date: undefined },
      { engineerId: 'alex', type: 'anniversary', date: '2027-03-13' },
      { engineerId: 'alex', type: 'birthday', date: undefined },
    ]);
  });

  it('has no anniversary for someone who is not on the team', () => {
    const { storage } = createStorage();

    expect(getDateEvents('ghost', storage, NOW).find((e) => e.type === 'anniversary')?.date).toBe(
      undefined,
    );
  });

  it('ignores stored records that are malformed or out of range', () => {
    const { storage } = createStorage({
      dateEvents: [
        event('alex', 'visa_expiry', '1850-01-01'),
        event('alex', 'probation_end', 'tomorrow'),
        event('alex', 'anniversary', '2026-07-01'),
        { engineerId: 7, type: 'birthday', date: '1990-01-01' },
        null,
      ],
    });

    expect(getDateEvents('alex', storage, NOW).filter((e) => e.type !== 'anniversary')).toEqual([
      { engineerId: 'alex', type: 'visa_expiry', date: undefined },
      { engineerId: 'alex', type: 'probation_end', date: undefined },
      { engineerId: 'alex', type: 'birthday', date: undefined },
    ]);
  });
});

describe('setDateEvent', () => {
  it('stores the date in the private envelope and forces the write', async () => {
    const { storage, data, flush, publicData } = createStorage();

    await setDateEvent('alex', 'visa_expiry', '2026-07-01', storage, NOW);

    expect(data.get('dateEvents')).toEqual([event('alex', 'visa_expiry', '2026-07-01')]);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(JSON.stringify([...publicData])).not.toContain('2026-07-01');
  });

  it('replaces the date for the same person and type, and leaves others alone', async () => {
    const { storage, data } = createStorage({
      dateEvents: [
        event('alex', 'visa_expiry', '2026-07-01'),
        event('priya', 'visa_expiry', '2026-08-01'),
      ],
    });

    await setDateEvent('alex', 'visa_expiry', '2026-09-09', storage, NOW);

    expect(data.get('dateEvents')).toEqual([
      event('priya', 'visa_expiry', '2026-08-01'),
      event('alex', 'visa_expiry', '2026-09-09'),
    ]);
  });

  it('clears a date when given null', async () => {
    const { storage, data } = createStorage({
      dateEvents: [event('alex', 'visa_expiry', '2026-07-01')],
    });

    await setDateEvent('alex', 'visa_expiry', null, storage, NOW);

    expect(data.get('dateEvents')).toEqual([]);
  });

  it.each([
    ['anniversary', '2026-07-01', 'Work anniversary is worked out from the start date'],
    ['passport', '2026-07-01', 'Date type is not valid'],
    ['visa_expiry', '1900-01-01', 'Enter a date between 1920 and 2100'],
    ['visa_expiry', '2200-01-01', 'Enter a date between 1920 and 2100'],
    ['visa_expiry', '2026-02-30', 'Enter a date between 1920 and 2100'],
    ['birthday', '2026-06-16', 'Birthday must be in the past'],
  ])('rejects %s on %s without repeating the date', async (type, date, message) => {
    const { storage, flush } = createStorage();

    const result = setDateEvent('alex', type as never, date, storage, NOW);

    await expect(result).rejects.toThrow(new ValidationError(message));
    await expect(result).rejects.toBeInstanceOf(ValidationError);
    expect(flush).not.toHaveBeenCalled();
  });

  it('rejects a person who is not on the team', async () => {
    const { storage } = createStorage();

    await expect(setDateEvent('ghost', 'visa_expiry', '2026-07-01', storage, NOW)).rejects.toThrow(
      'Person must be on your team',
    );
  });

  it('allows a birthday today', async () => {
    const { storage, data } = createStorage();

    await setDateEvent('alex', 'birthday', '2026-06-15', storage, NOW);

    expect(data.get('dateEvents')).toEqual([event('alex', 'birthday', '2026-06-15')]);
  });

  it('puts the previous dates back and rethrows when the write fails', async () => {
    const failure = new StorageWriteError(false, true);
    const previous = [event('alex', 'visa_expiry', '2026-07-01')];
    const { storage, data } = createStorage({ dateEvents: previous }, {}, failure);

    await expect(setDateEvent('alex', 'visa_expiry', '2026-09-09', storage, NOW)).rejects.toBe(
      failure,
    );

    expect(data.get('dateEvents')).toEqual(previous);
  });
});

describe('lead times', () => {
  it('defaults to 30, 14, 7 and 1 days', () => {
    expect(getLeadTimeConfig(createStorage().storage)).toEqual({
      visa_expiry: 30,
      probation_end: 14,
      anniversary: 7,
      birthday: 1,
    });
  });

  it('saves a change in settings and keeps the rest', async () => {
    const { storage, flush } = createStorage();

    await setLeadTimeConfig({ probation_end: 21 }, storage);

    expect(getLeadTimeConfig(storage)).toEqual({ ...DEFAULT_LEAD_TIMES, probation_end: 21 });
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it.each([0, -3, 91, 2.5, Number.NaN])('rejects %s days', async (days) => {
    const { storage, flush } = createStorage();

    await expect(setLeadTimeConfig({ birthday: days }, storage)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(flush).not.toHaveBeenCalled();
  });

  it('rejects an unknown event type', async () => {
    const { storage } = createStorage();

    await expect(setLeadTimeConfig({ passport: 5 } as never, storage)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('falls back to defaults for saved values that are damaged', () => {
    const { storage } = createStorage(
      {},
      { reminderLeadTimes: JSON.stringify({ visa_expiry: 0, probation_end: '9', birthday: 90 }) },
    );

    expect(getLeadTimeConfig(storage)).toEqual({ ...DEFAULT_LEAD_TIMES, birthday: 90 });
  });

  it.each(['not json', '"text"', 'null'])('falls back to defaults for %s', (saved) => {
    expect(getLeadTimeConfig(createStorage({}, { reminderLeadTimes: saved }).storage)).toEqual(
      DEFAULT_LEAD_TIMES,
    );
  });

  it('puts the previous settings back when the write fails', async () => {
    const failure = new StorageWriteError(false, false);
    const { storage } = createStorage({}, {}, failure);

    await expect(setLeadTimeConfig({ birthday: 5 }, storage)).rejects.toBe(failure);

    expect(getLeadTimeConfig(storage).birthday).toBe(1);
  });
});

describe('getDueDateReminders', () => {
  const due = (events: unknown[], settings: Record<string, string> = {}, members = [ALEX, PRIYA]) =>
    getDueDateReminders(
      createStorage({ dateEvents: events }, settings, null, members).storage,
      NOW,
    );

  it('includes a visa expiring inside its 30 day lead time, and only then', () => {
    expect(due([event('alex', 'visa_expiry', '2026-07-15')])).toEqual([
      expect.objectContaining({ type: 'visa_expiry', daysUntil: 30, eventDate: '2026-07-15' }),
    ]);
    expect(due([event('alex', 'visa_expiry', '2026-07-16')])).toEqual([]);
  });

  it('includes a probation end inside 14 days', () => {
    expect(due([event('alex', 'probation_end', '2026-06-29')])).toHaveLength(1);
    expect(due([event('alex', 'probation_end', '2026-06-30')])).toEqual([]);
  });

  it('includes a birthday today or tomorrow, but not later', () => {
    const today = due([event('alex', 'birthday', '1990-06-15')]);
    const tomorrow = due([event('alex', 'birthday', '1990-06-16')]);
    const later = due([event('alex', 'birthday', '1990-06-17')]);

    expect(today).toEqual([expect.objectContaining({ type: 'birthday', daysUntil: 0 })]);
    expect(tomorrow).toEqual([expect.objectContaining({ type: 'birthday', daysUntil: 1 })]);
    expect(later).toEqual([]);
  });

  it('includes an anniversary with its tenure and a conversation starter', () => {
    const [anniversary] = due([], {}, [SAM]);

    expect(anniversary).toEqual({
      engineerId: 'sam',
      engineerName: 'Sam Lee',
      type: 'anniversary',
      eventDate: '2026-06-18',
      daysUntil: 3,
      tenureYears: 2,
      conversationStarter:
        "Sam's 2-year anniversary is in 3 days. A good moment to acknowledge their growth.",
    });
  });

  it('says "next week" when the anniversary is exactly a week away', () => {
    const [anniversary] = due([], {}, [
      createMember({ id: 'sam', name: 'Sam Lee', startDate: '2023-06-22' }),
    ]);

    expect(anniversary.conversationStarter).toContain("Sam's 3-year anniversary is next week");
  });

  it('never gives a visa or probation reminder a conversation starter', () => {
    const reminders = due([
      event('alex', 'visa_expiry', '2026-06-16'),
      event('alex', 'probation_end', '2026-06-16'),
    ]);

    const sensitive = reminders.filter(
      (r) => r.type === 'visa_expiry' || r.type === 'probation_end',
    );
    expect(sensitive).toHaveLength(2);
    expect(sensitive.every((r) => r.conversationStarter === undefined)).toBe(true);
    const starters = reminders.map((r) => r.conversationStarter ?? '').join(' ');
    expect(starters).not.toMatch(/visa|probation/i);
  });

  it('skips a visa or probation date that has already passed', () => {
    expect(
      due([
        event('alex', 'visa_expiry', '2026-06-14'),
        event('alex', 'probation_end', '2026-06-01'),
      ]),
    ).toEqual([]);
  });

  it('brings a birthday round again next year', () => {
    const reminders = getDueDateReminders(
      createStorage({ dateEvents: [event('alex', 'birthday', '1990-06-15')] }).storage,
      new Date(2027, 5, 14),
    );

    expect(reminders).toEqual([
      expect.objectContaining({ type: 'birthday', eventDate: '2027-06-15', daysUntil: 1 }),
    ]);
  });

  it('generates nothing for a field that is unset', () => {
    expect(
      due([], {}, [createMember({ id: 'sam', name: 'Sam', startDate: '2025-01-01' })]),
    ).toEqual([]);
  });

  it('respects a custom lead time', () => {
    const events = [event('alex', 'probation_end', '2026-07-03')];

    expect(due(events).some((r) => r.type === 'probation_end')).toBe(false);
    expect(
      due(events, { reminderLeadTimes: JSON.stringify({ probation_end: 21 }) }).some(
        (r) => r.type === 'probation_end',
      ),
    ).toBe(true);
  });

  it('lists the soonest first, then by event type, then by name', () => {
    const reminders = due(
      [
        event('priya', 'birthday', '1990-06-15'),
        event('alex', 'birthday', '1990-06-15'),
        event('alex', 'visa_expiry', '2026-06-20'),
      ],
      {},
      [ALEX, PRIYA, SAM],
    );

    expect(reminders.map((r) => `${r.daysUntil}:${r.type}:${r.engineerName}`)).toEqual([
      '0:birthday:Alex Chen',
      '0:birthday:Priya Nair',
      '3:anniversary:Sam Lee',
      '5:visa_expiry:Alex Chen',
    ]);
  });

  it('ignores dates for people who are no longer on the team', () => {
    expect(due([event('ghost', 'visa_expiry', '2026-06-16')], {}, [])).toEqual([]);
  });

  it('does not log anything', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );

    due([event('alex', 'visa_expiry', '2026-06-16')]);

    spies.forEach((spy) => {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});

describe('deleteDateEventsForMember', () => {
  it('removes only that person’s dates', async () => {
    const keep = event('priya', 'visa_expiry', '2026-08-01');
    const { storage, data } = createStorage({
      dateEvents: [
        event('alex', 'visa_expiry', '2026-07-01'),
        event('alex', 'birthday', '1990-01-01'),
        keep,
      ],
    });

    await deleteDateEventsForMember('alex', storage);

    expect(data.get('dateEvents')).toEqual([keep]);
  });

  it('puts the dates back and rethrows when the write fails', async () => {
    const failure = new StorageWriteError(false, true);
    const previous = [event('alex', 'visa_expiry', '2026-07-01')];
    const { storage, data } = createStorage({ dateEvents: previous }, {}, failure);

    await expect(deleteDateEventsForMember('alex', storage)).rejects.toBe(failure);

    expect(data.get('dateEvents')).toEqual(previous);
  });
});

describe('isDateEventType', () => {
  it('accepts the four types and nothing else', () => {
    expect(['visa_expiry', 'probation_end', 'anniversary', 'birthday'].every(isDateEventType)).toBe(
      true,
    );
    expect(isDateEventType('passport')).toBe(false);
    expect(isDateEventType(3)).toBe(false);
  });
});
