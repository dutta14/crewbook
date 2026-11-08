import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type {
  Reminder,
  ReminderContext,
  ReminderStatus,
  SnoozeOption,
  TriggerType,
} from '../types/reminder';
import type { TeamMember } from '../types/TeamMember';
import { parseIsoDate, skipNext, toIsoDate } from '../utils/scheduleCalculator';
import { NotFoundError, ValidationError } from './errors';
import { getMember } from './members';

/** Reminder text can be about performance or resignations, so it lives in the private envelope. */
const STORAGE_KEY = 'reminders';

/** Needs `get` as well because linked people are validated against the team list. */
export type ReminderStorage = Pick<
  EncryptedStorageContextValue,
  'get' | 'set' | 'getPrivate' | 'setPrivate' | 'flush'
>;

export const REMINDER_TEXT_MAX_LENGTH = 500;
export const SNOOZE_FALLBACK_DAYS = 7;

export const TRIGGER_TYPES: readonly TriggerType[] = ['next_1on1', 'specific_date'];
export const SNOOZE_OPTIONS: readonly SnoozeOption[] = ['1_day', '1_week', 'next_1on1'];
const REMINDER_STATUSES: readonly ReminderStatus[] = ['active', 'snoozed', 'dismissed'];

export interface ReminderInput {
  text: string;
  linkedPersonId: string;
  triggerType: TriggerType;
  /** YYYY-MM-DD. Required when the trigger is a specific date; ignored otherwise. */
  triggerDate?: string;
}

export interface SnoozeResult {
  reminder: Reminder;
  /** True when "next 1:1" could not be resolved, so the reminder was snoozed for a week instead. */
  usedFallback: boolean;
}

export function isTriggerType(value: unknown): value is TriggerType {
  return typeof value === 'string' && (TRIGGER_TYPES as readonly string[]).includes(value);
}

export function isSnoozeOption(value: unknown): value is SnoozeOption {
  return typeof value === 'string' && (SNOOZE_OPTIONS as readonly string[]).includes(value);
}

const isString = (value: unknown): value is string => typeof value === 'string';
const isOptionalString = (value: unknown) => value === undefined || isString(value);

function isReminder(value: unknown): value is Reminder {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isString(item.id) &&
    isString(item.text) &&
    isString(item.linkedPersonId) &&
    isString(item.linkedPersonName) &&
    isTriggerType(item.triggerType) &&
    isOptionalString(item.triggerDate) &&
    typeof item.status === 'string' &&
    (REMINDER_STATUSES as readonly string[]).includes(item.status) &&
    isOptionalString(item.snoozedUntil) &&
    isString(item.createdAt) &&
    isOptionalString(item.dismissedAt)
  );
}

function readReminders(storage: ReminderStorage): Reminder[] {
  const stored = storage.getPrivate<unknown>(STORAGE_KEY);
  return Array.isArray(stored) ? stored.filter(isReminder) : [];
}

/** Throws a ValidationError that never repeats the text. */
function cleanText(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Reminder must be text');
  const text = value.trim();
  if (text.length === 0) throw new ValidationError('Reminder is required');
  if (text.length > REMINDER_TEXT_MAX_LENGTH) {
    throw new ValidationError(`Reminder must be ${REMINDER_TEXT_MAX_LENGTH} characters or fewer`);
  }
  return text;
}

function cleanTrigger(
  triggerType: unknown,
  triggerDate: unknown,
  now: Date,
): Pick<Reminder, 'triggerType' | 'triggerDate'> {
  if (!isTriggerType(triggerType)) throw new ValidationError('Trigger is not valid');
  if (triggerType === 'next_1on1') return { triggerType };
  if (typeof triggerDate !== 'string' || triggerDate === '') {
    throw new ValidationError('Choose a date for this reminder');
  }
  if (parseIsoDate(triggerDate) === null) throw new ValidationError('Date is not valid');
  // Today is allowed, so a reminder can be set for later the same day.
  if (triggerDate < toIsoDate(now)) throw new ValidationError('Date must be in the future');
  return { triggerType, triggerDate };
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
  storage: ReminderStorage,
  previous: Reminder[],
  next: Reminder[],
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

export function createReminder(
  input: ReminderInput,
  storage: ReminderStorage,
  now: Date = new Date(),
): Promise<Reminder> {
  return enqueue(async () => {
    const text = cleanText(input.text);
    const trigger = cleanTrigger(input.triggerType, input.triggerDate, now);
    const person =
      typeof input.linkedPersonId === 'string' ? getMember(input.linkedPersonId, storage) : null;
    if (!person) throw new ValidationError('Linked person must be on your team');
    const reminder: Reminder = {
      id: crypto.randomUUID(),
      text,
      linkedPersonId: person.id,
      linkedPersonName: person.name,
      ...trigger,
      status: 'active',
      createdAt: now.toISOString(),
    };
    const previous = readReminders(storage);
    await commit(storage, previous, [...previous, reminder]);
    return { ...reminder };
  });
}

/** Reads the current reminder inside the write queue, so back-to-back updates never see stale data. */
function update(
  id: string,
  storage: ReminderStorage,
  build: (existing: Reminder) => Reminder,
): Promise<Reminder> {
  return enqueue(async () => {
    const previous = readReminders(storage);
    const existing = previous.find((item) => item.id === id);
    if (!existing) throw new NotFoundError(id);
    const updated = build(existing);
    await commit(
      storage,
      previous,
      previous.map((item) => (item.id === id ? updated : item)),
    );
    return { ...updated };
  });
}

export function dismissReminder(
  id: string,
  storage: ReminderStorage,
  now: Date = new Date(),
): Promise<Reminder> {
  return update(id, storage, (existing) => {
    const dismissed: Reminder = {
      ...existing,
      status: 'dismissed',
      dismissedAt: now.toISOString(),
    };
    delete dismissed.snoozedUntil;
    return dismissed;
  });
}

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * The calendar day of the first scheduled 1:1 after today, or null when the person has no schedule
 * that can be resolved. A 1:1 that falls today is already underway, so it is not "next".
 */
export function getNextOneOnOneDate(
  member: Pick<TeamMember, 'schedule'> | null,
  now: Date = new Date(),
): string | null {
  const schedule = member?.schedule;
  if (!schedule || parseIsoDate(schedule.nextDate) === null) return null;
  const today = toIsoDate(now);
  if (schedule.nextDate > today) return schedule.nextDate;
  const following = skipNext(schedule, now).nextDate;
  return following > today ? following : null;
}

/** Choosing "next 1:1" turns the reminder into one that waits for that meeting. */
export function snoozeReminder(
  id: string,
  option: SnoozeOption,
  storage: ReminderStorage,
  now: Date = new Date(),
): Promise<SnoozeResult> {
  if (!isSnoozeOption(option)) {
    return Promise.reject(new ValidationError('Snooze option is not valid'));
  }
  let usedFallback = false;
  return update(id, storage, (existing) => {
    const fallback = toIsoDate(addDays(now, SNOOZE_FALLBACK_DAYS));
    if (option === '1_day') {
      return { ...existing, status: 'snoozed', snoozedUntil: toIsoDate(addDays(now, 1)) };
    }
    if (option === '1_week') {
      return { ...existing, status: 'snoozed', snoozedUntil: fallback };
    }
    const nextOneOnOne = getNextOneOnOneDate(getMember(existing.linkedPersonId, storage), now);
    usedFallback = nextOneOnOne === null;
    const waiting: Reminder = {
      ...existing,
      triggerType: 'next_1on1',
      status: 'snoozed',
      snoozedUntil: nextOneOnOne ?? fallback,
    };
    delete waiting.triggerDate;
    return waiting;
  }).then((reminder) => ({ reminder, usedFallback }));
}

/** Every reminder in the order it was created, optionally for one person. */
export function getReminders(storage: ReminderStorage, personId?: string): Reminder[] {
  return readReminders(storage)
    .filter((item) => personId === undefined || item.linkedPersonId === personId)
    .map((item) => ({ ...item }));
}

/** Whether a snooze is still running on the given day. */
export function isReminderSnoozed(
  reminder: Pick<Reminder, 'status' | 'snoozedUntil'>,
  now: Date = new Date(),
): boolean {
  return (
    reminder.status !== 'dismissed' &&
    reminder.snoozedUntil !== undefined &&
    reminder.snoozedUntil > toIsoDate(now)
  );
}

/**
 * Next-1:1 reminders are due for prep and live mode until they are dismissed. Date reminders are
 * due on the dashboard from their day onward, so a day without the app does not lose them.
 * Snoozed reminders wait for their snooze to end. This never logs its arguments.
 */
export function isReminderDue(
  reminder: Reminder,
  context: ReminderContext,
  now: Date = new Date(),
): boolean {
  if (reminder.status === 'dismissed' || isReminderSnoozed(reminder, now)) return false;
  if (context === '1on1_prep') return reminder.triggerType === 'next_1on1';
  return (
    reminder.triggerType === 'specific_date' &&
    reminder.triggerDate !== undefined &&
    reminder.triggerDate <= toIsoDate(now)
  );
}

const byDueOrder = (a: Reminder, b: Reminder) =>
  (a.triggerDate ?? '').localeCompare(b.triggerDate ?? '') ||
  Date.parse(a.createdAt) - Date.parse(b.createdAt);

/** Pass no person on the dashboard to get everyone's. */
export function getDueReminders(
  storage: ReminderStorage,
  personId: string | undefined,
  context: ReminderContext,
  now: Date = new Date(),
): Reminder[] {
  return getReminders(storage, personId)
    .filter((item) => isReminderDue(item, context, now))
    .sort(byDueOrder);
}

/** Removes every reminder about a member, for when they leave the team. */
export function deleteRemindersForMember(
  memberId: string,
  storage: ReminderStorage,
): Promise<void> {
  return enqueue(async () => {
    const previous = readReminders(storage);
    await commit(
      storage,
      previous,
      previous.filter((item) => item.linkedPersonId !== memberId),
    );
  });
}
