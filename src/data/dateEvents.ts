import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type {
  DateEvent,
  DateEventType,
  DateReminderData,
  LeadTimeConfig,
  StoredDateEventType,
} from '../types/dateEvent';
import { buildConversationStarter } from '../utils/dateEventFormat';
import { parseIsoDate, toIsoDate } from '../utils/scheduleCalculator';
import { daysUntilStart, toDateAttribute } from '../utils/startDate';
import { ValidationError } from './errors';
import { getMember, listMembers } from './members';
import { getSetting, writeSetting } from './settings';

/**
 * Visa, probation and birthday dates are the most sensitive data in the app, so they live in the
 * private envelope next to notes and are purged with the person. Lead times are plain settings.
 */
const STORAGE_KEY = 'dateEvents';
const LEAD_TIMES_KEY = 'reminderLeadTimes';

export type DateEventStorage = Pick<
  EncryptedStorageContextValue,
  'get' | 'set' | 'getPrivate' | 'setPrivate' | 'flush'
>;

export const DATE_EVENT_TYPES: readonly DateEventType[] = [
  'visa_expiry',
  'probation_end',
  'anniversary',
  'birthday',
];
export const STORED_DATE_EVENT_TYPES: readonly StoredDateEventType[] = [
  'visa_expiry',
  'probation_end',
  'birthday',
];

export const DEFAULT_LEAD_TIMES: Readonly<LeadTimeConfig> = {
  visa_expiry: 30,
  probation_end: 14,
  anniversary: 7,
  birthday: 1,
};
export const LEAD_TIME_MIN_DAYS = 1;
export const LEAD_TIME_MAX_DAYS = 90;

export const DATE_EVENT_MIN_YEAR = 1920;
export const DATE_EVENT_MAX_YEAR = 2100;

interface StoredDateEvent {
  engineerId: string;
  type: StoredDateEventType;
  date: string;
}

export function isDateEventType(value: unknown): value is DateEventType {
  return typeof value === 'string' && (DATE_EVENT_TYPES as readonly string[]).includes(value);
}

export function isStoredDateEventType(value: unknown): value is StoredDateEventType {
  return (
    typeof value === 'string' && (STORED_DATE_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export function isValidLeadTime(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= LEAD_TIME_MIN_DAYS &&
    value <= LEAD_TIME_MAX_DAYS
  );
}

/** A real calendar day within a sane range. */
export function isReasonableDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const day = parseIsoDate(value);
  if (!day) return false;
  const year = day.getFullYear();
  return year >= DATE_EVENT_MIN_YEAR && year <= DATE_EVENT_MAX_YEAR;
}

function isStoredDateEvent(value: unknown): value is StoredDateEvent {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.engineerId === 'string' &&
    isStoredDateEventType(item.type) &&
    isReasonableDate(item.date)
  );
}

function readEvents(storage: DateEventStorage): StoredDateEvent[] {
  const stored = storage.getPrivate<unknown>(STORAGE_KEY);
  return Array.isArray(stored) ? stored.filter(isStoredDateEvent) : [];
}

// Writes run one at a time so a rollback can never overwrite a later, successful write.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => undefined);
  return result;
}

/** Applies the change to memory, forces the encrypted write and restores `previous` on failure. */
async function commit(
  storage: DateEventStorage,
  previous: StoredDateEvent[],
  next: StoredDateEvent[],
): Promise<void> {
  storage.setPrivate(STORAGE_KEY, next);
  const failure = await storage.flush();
  if (!failure) return;
  try {
    storage.setPrivate(STORAGE_KEY, previous);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
  throw failure;
}

const daysInMonth = (year: number, monthIndex: number) =>
  new Date(year, monthIndex + 1, 0).getDate();

/** The yearly date in `year`. 29 February falls on the 28th in years that are not leap years. */
function inYear(origin: Date, year: number): string {
  const monthIndex = origin.getMonth();
  const day = Math.min(origin.getDate(), daysInMonth(year, monthIndex));
  return toIsoDate(new Date(year, monthIndex, day));
}

/** The first year, from this one on, in which a yearly date has not yet passed. */
function nextYearlyOccurrence(origin: Date, now: Date): { date: string; year: number } {
  const year = now.getFullYear();
  const thisYear = inYear(origin, year);
  return thisYear >= toIsoDate(now)
    ? { date: thisYear, year }
    : { date: inYear(origin, year + 1), year: year + 1 };
}

/** The next work anniversary, or null when the start date is not usable. */
export function getNextAnniversary(
  startDate: string,
  now: Date = new Date(),
): { date: string; years: number } | null {
  const origin = parseIsoDate(toDateAttribute(startDate));
  if (!origin) return null;
  const startYear = origin.getFullYear();
  const occurrence = nextYearlyOccurrence(origin, now);
  // A start date that is today or still ahead has no anniversary until its first year is up.
  const year = Math.max(occurrence.year, startYear + 1);
  return {
    date: year === occurrence.year ? occurrence.date : inYear(origin, year),
    years: year - startYear,
  };
}

/** The next birthday on or after today. */
export function getNextBirthday(birthday: string, now: Date = new Date()): string | null {
  const origin = parseIsoDate(birthday);
  return origin ? nextYearlyOccurrence(origin, now).date : null;
}

/**
 * All four date events for one person, in display order. The anniversary is worked out from the
 * start date, so it is not stored and has no date when the person is not on the team.
 */
export function getDateEvents(
  engineerId: string,
  storage: DateEventStorage,
  now: Date = new Date(),
): DateEvent[] {
  const stored = readEvents(storage).filter((item) => item.engineerId === engineerId);
  const dateOf = (type: StoredDateEventType) => stored.find((item) => item.type === type)?.date;
  const member = getMember(engineerId, storage);
  const anniversary = member ? getNextAnniversary(member.startDate, now) : null;
  return [
    { engineerId, type: 'visa_expiry', date: dateOf('visa_expiry') },
    { engineerId, type: 'probation_end', date: dateOf('probation_end') },
    { engineerId, type: 'anniversary', date: anniversary?.date },
    { engineerId, type: 'birthday', date: dateOf('birthday') },
  ];
}

/** Pass null to clear the date. Error messages never repeat the date that was entered. */
export function setDateEvent(
  engineerId: string,
  type: DateEventType,
  date: string | null,
  storage: DateEventStorage,
  now: Date = new Date(),
): Promise<void> {
  return enqueue(async () => {
    if (!isStoredDateEventType(type)) {
      throw new ValidationError(
        type === 'anniversary'
          ? 'Work anniversary is worked out from the start date'
          : 'Date type is not valid',
      );
    }
    if (typeof engineerId !== 'string' || !getMember(engineerId, storage)) {
      throw new ValidationError('Person must be on your team');
    }
    if (date !== null) {
      if (!isReasonableDate(date)) {
        throw new ValidationError(
          `Enter a date between ${DATE_EVENT_MIN_YEAR} and ${DATE_EVENT_MAX_YEAR}`,
        );
      }
      if (type === 'birthday' && date > toIsoDate(now)) {
        throw new ValidationError('Birthday must be in the past');
      }
    }
    const previous = readEvents(storage);
    const others = previous.filter(
      (item) => !(item.engineerId === engineerId && item.type === type),
    );
    await commit(
      storage,
      previous,
      date === null ? others : [...others, { engineerId, type, date }],
    );
  });
}

/** Lead times fall back to their defaults for anything missing or out of range. */
export function getLeadTimeConfig(storage: Pick<DateEventStorage, 'get'>): LeadTimeConfig {
  const config: LeadTimeConfig = { ...DEFAULT_LEAD_TIMES };
  const raw = getSetting(storage, LEAD_TIMES_KEY);
  if (raw === undefined) return config;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return config;
  }
  if (typeof parsed !== 'object' || parsed === null) return config;
  const saved = parsed as Record<string, unknown>;
  for (const type of DATE_EVENT_TYPES) {
    if (isValidLeadTime(saved[type])) config[type] = saved[type];
  }
  return config;
}

export function setLeadTimeConfig(
  config: Partial<LeadTimeConfig>,
  storage: DateEventStorage,
): Promise<void> {
  const next = { ...getLeadTimeConfig(storage) };
  for (const [type, days] of Object.entries(config)) {
    if (!isDateEventType(type) || !isValidLeadTime(days)) {
      return Promise.reject(
        new ValidationError(
          `Lead time must be a whole number of days from ${LEAD_TIME_MIN_DAYS} to ${LEAD_TIME_MAX_DAYS}`,
        ),
      );
    }
    next[type] = days;
  }
  return writeSetting(LEAD_TIMES_KEY, JSON.stringify(next), storage);
}

/** Removes every date about a member, for when they leave the team. */
export function deleteDateEventsForMember(
  memberId: string,
  storage: DateEventStorage,
): Promise<void> {
  return enqueue(async () => {
    const previous = readEvents(storage);
    await commit(
      storage,
      previous,
      previous.filter((item) => item.engineerId !== memberId),
    );
  });
}

const TYPE_ORDER = new Map(DATE_EVENT_TYPES.map((type, index) => [type, index]));

/**
 * Reminders for every date event that falls within its lead time, soonest first. Past dates are
 * skipped, except birthdays and anniversaries, which come round again. Nothing here is stored or
 * logged: conversation starters are built from this call's in-memory data.
 */
export function getDueDateReminders(
  storage: DateEventStorage,
  now: Date = new Date(),
): DateReminderData[] {
  const leadTimes = getLeadTimeConfig(storage);
  const stored = readEvents(storage);
  const reminders: DateReminderData[] = [];

  for (const member of listMembers(storage)) {
    const candidates: Array<{ type: DateEventType; eventDate: string; tenureYears?: number }> = [];
    for (const type of STORED_DATE_EVENT_TYPES) {
      const date = stored.find((item) => item.engineerId === member.id && item.type === type)?.date;
      if (date === undefined) continue;
      const eventDate = type === 'birthday' ? getNextBirthday(date, now) : date;
      if (eventDate) candidates.push({ type, eventDate });
    }
    const anniversary = getNextAnniversary(member.startDate, now);
    if (anniversary) {
      candidates.push({
        type: 'anniversary',
        eventDate: anniversary.date,
        tenureYears: anniversary.years,
      });
    }

    for (const { type, eventDate, tenureYears } of candidates) {
      const daysUntil = daysUntilStart(eventDate, now);
      if (daysUntil < 0 || daysUntil > leadTimes[type]) continue;
      const conversationStarter = buildConversationStarter(
        type,
        member.name,
        daysUntil,
        tenureYears,
      );
      reminders.push({
        engineerId: member.id,
        engineerName: member.name,
        type,
        eventDate,
        daysUntil,
        ...(tenureYears === undefined ? {} : { tenureYears }),
        ...(conversationStarter === undefined ? {} : { conversationStarter }),
      });
    }
  }

  return reminders.sort(
    (a, b) =>
      a.daysUntil - b.daysUntil ||
      (TYPE_ORDER.get(a.type) ?? 0) - (TYPE_ORDER.get(b.type) ?? 0) ||
      a.engineerName.localeCompare(b.engineerName),
  );
}
