import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import type {
  Decision,
  DecisionFollowUpFilter,
  FollowUp,
  FollowUpStatus,
} from '../types/decisions';
import { isOverdue as isPastDay, parseIsoDate, toIsoDate } from '../utils/scheduleCalculator';
import { MANAGER_OWNER_ID, MANAGER_OWNER_NAME } from './actionItems';
import { NotFoundError, ValidationError } from './errors';
import { getMember } from './members';

/** Titles and rationale can be strategic or about performance, so both live in the private envelope. */
const DECISIONS_KEY = 'decisions';
const FOLLOW_UPS_KEY = 'followUps';

/** Needs `get` as well because owners and engineers are validated against the team list. */
export type DecisionStorage = Pick<
  EncryptedStorageContextValue,
  'get' | 'set' | 'getPrivate' | 'setPrivate' | 'flush'
>;

export const DECISION_TITLE_MAX_LENGTH = 200;
export const DECISION_CONTEXT_MAX_LENGTH = 2000;

export const FOLLOW_UP_STATUSES: readonly FollowUpStatus[] = ['pending', 'done'];
export const DECISION_FOLLOW_UP_FILTERS: readonly DecisionFollowUpFilter[] = [
  'all',
  'decisions',
  'follow-ups',
];

export interface DecisionInput {
  engineerId: string;
  title: string;
  context?: string;
  /** YYYY-MM-DD; today when omitted. */
  date?: string;
  linkedMeetingId?: string;
  linkedMeetingDate?: string;
}

export interface FollowUpInput {
  engineerId: string;
  title: string;
  ownerId: string;
  dueDate?: string;
  status?: FollowUpStatus;
  linkedMeetingId?: string;
  linkedMeetingDate?: string;
}

export function isFollowUpStatus(value: unknown): value is FollowUpStatus {
  return typeof value === 'string' && (FOLLOW_UP_STATUSES as readonly string[]).includes(value);
}

export function isDecisionFollowUpFilter(value: unknown): value is DecisionFollowUpFilter {
  return (
    typeof value === 'string' && (DECISION_FOLLOW_UP_FILTERS as readonly string[]).includes(value)
  );
}

const isString = (value: unknown): value is string => typeof value === 'string';

function isDecision(value: unknown): value is Decision {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isString(item.id) &&
    isString(item.engineerId) &&
    isString(item.title) &&
    isString(item.context) &&
    isString(item.date) &&
    isString(item.linkedMeetingId) &&
    isString(item.linkedMeetingDate) &&
    isString(item.createdAt)
  );
}

function isFollowUp(value: unknown): value is FollowUp {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    isString(item.id) &&
    isString(item.engineerId) &&
    isString(item.title) &&
    isString(item.ownerId) &&
    isString(item.ownerName) &&
    (item.dueDate === undefined || isString(item.dueDate)) &&
    isFollowUpStatus(item.status) &&
    isString(item.linkedMeetingId) &&
    isString(item.linkedMeetingDate) &&
    isString(item.createdAt)
  );
}

function readDecisions(storage: DecisionStorage): Decision[] {
  const stored = storage.getPrivate<unknown>(DECISIONS_KEY);
  return Array.isArray(stored) ? stored.filter(isDecision) : [];
}

function readFollowUps(storage: DecisionStorage): FollowUp[] {
  const stored = storage.getPrivate<unknown>(FOLLOW_UPS_KEY);
  return Array.isArray(stored) ? stored.filter(isFollowUp) : [];
}

/** Throws a ValidationError that never repeats the title. */
function cleanTitle(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('Title must be text');
  const title = value.replace(/\s+/g, ' ').trim();
  if (title.length === 0) throw new ValidationError('Title is required');
  if (title.length > DECISION_TITLE_MAX_LENGTH) {
    throw new ValidationError(`Title must be ${DECISION_TITLE_MAX_LENGTH} characters or fewer`);
  }
  return title;
}

/** Keeps line breaks, since rationale is prose. */
function cleanContext(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new ValidationError('Context must be text');
  const context = value.trim();
  if (context.length > DECISION_CONTEXT_MAX_LENGTH) {
    throw new ValidationError(`Context must be ${DECISION_CONTEXT_MAX_LENGTH} characters or fewer`);
  }
  return context;
}

function cleanDay(value: unknown, message: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || parseIsoDate(value) === null) throw new ValidationError(message);
  return value;
}

function cleanLink(input: { linkedMeetingId?: string; linkedMeetingDate?: string }) {
  const id = input.linkedMeetingId ?? '';
  if (typeof id !== 'string') throw new ValidationError('Meeting is not valid');
  const date = cleanDay(input.linkedMeetingDate, 'Meeting date is not a valid date') ?? '';
  return { linkedMeetingId: id, linkedMeetingDate: date };
}

function requireEngineer(engineerId: unknown, storage: DecisionStorage): string {
  if (typeof engineerId !== 'string' || !getMember(engineerId, storage)) {
    throw new ValidationError('This needs a team member');
  }
  return engineerId;
}

/** The owner must be the manager or someone on the team; the name always comes from the team. */
function resolveOwner(ownerId: unknown, storage: DecisionStorage) {
  if (ownerId === MANAGER_OWNER_ID) return { ownerId, ownerName: MANAGER_OWNER_NAME };
  const owner = typeof ownerId === 'string' ? getMember(ownerId, storage) : null;
  if (!owner) throw new ValidationError('Owner must be you or a team member');
  return { ownerId: owner.id, ownerName: owner.name };
}

// Writes run one at a time so a rollback can never overwrite a later, successful write.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => undefined);
  return result;
}

interface Records {
  decisions: Decision[];
  followUps: FollowUp[];
}

function readRecords(storage: DecisionStorage): Records {
  return { decisions: readDecisions(storage), followUps: readFollowUps(storage) };
}

/** Applies the change to memory, forces the encrypted write and restores `previous` on failure. */
async function commit(storage: DecisionStorage, previous: Records, next: Records): Promise<void> {
  storage.setPrivate(DECISIONS_KEY, next.decisions);
  storage.setPrivate(FOLLOW_UPS_KEY, next.followUps);
  const failure = await storage.flush();
  if (!failure) return;
  try {
    storage.setPrivate(DECISIONS_KEY, previous.decisions);
    storage.setPrivate(FOLLOW_UPS_KEY, previous.followUps);
  } catch {
    // Storage was locked meanwhile; locking already dropped the in-memory copy.
  }
  throw failure;
}

export function createDecision(input: DecisionInput, storage: DecisionStorage): Promise<Decision> {
  return enqueue(async () => {
    const title = cleanTitle(input.title);
    const context = cleanContext(input.context);
    const date = cleanDay(input.date, 'Date is not valid') ?? toIsoDate(new Date());
    const engineerId = requireEngineer(input.engineerId, storage);
    const decision: Decision = {
      id: crypto.randomUUID(),
      engineerId,
      title,
      context,
      date,
      ...cleanLink(input),
      createdAt: new Date().toISOString(),
    };
    const previous = readRecords(storage);
    await commit(storage, previous, { ...previous, decisions: [...previous.decisions, decision] });
    return { ...decision };
  });
}

export function createFollowUp(input: FollowUpInput, storage: DecisionStorage): Promise<FollowUp> {
  return enqueue(async () => {
    const title = cleanTitle(input.title);
    const dueDate = cleanDay(input.dueDate, 'Due date is not a valid date');
    const status = input.status ?? 'pending';
    if (!isFollowUpStatus(status)) throw new ValidationError('Status is not valid');
    const engineerId = requireEngineer(input.engineerId, storage);
    const owner = resolveOwner(input.ownerId, storage);
    const followUp: FollowUp = {
      id: crypto.randomUUID(),
      engineerId,
      title,
      ...owner,
      ...(dueDate ? { dueDate } : {}),
      status,
      ...cleanLink(input),
      createdAt: new Date().toISOString(),
    };
    const previous = readRecords(storage);
    await commit(storage, previous, { ...previous, followUps: [...previous.followUps, followUp] });
    return { ...followUp };
  });
}

/** Newest first; records made in the same millisecond keep the order they were written in. */
function newestFirst<T extends { createdAt: string }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) => Date.parse(b.item.createdAt) - Date.parse(a.item.createdAt) || b.index - a.index,
    )
    .map(({ item }) => ({ ...item }));
}

/** Every decision, or just one person's, newest first. */
export function getDecisions(storage: DecisionStorage, engineerId?: string): Decision[] {
  return newestFirst(
    readDecisions(storage).filter(
      (item) => engineerId === undefined || item.engineerId === engineerId,
    ),
  );
}

/** Every follow-up, or just one person's, newest first. */
export function getFollowUps(storage: DecisionStorage, engineerId?: string): FollowUp[] {
  return newestFirst(
    readFollowUps(storage).filter(
      (item) => engineerId === undefined || item.engineerId === engineerId,
    ),
  );
}

/** Writes straight to the encrypted store, so toggling back is just another call. */
export function toggleFollowUpStatus(id: string, storage: DecisionStorage): Promise<FollowUp> {
  return enqueue(async () => {
    const previous = readRecords(storage);
    const existing = previous.followUps.find((item) => item.id === id);
    if (!existing) throw new NotFoundError(id);
    const updated: FollowUp = {
      ...existing,
      status: existing.status === 'pending' ? 'done' : 'pending',
    };
    await commit(storage, previous, {
      ...previous,
      followUps: previous.followUps.map((item) => (item.id === id ? updated : item)),
    });
    return { ...updated };
  });
}

/**
 * Points everything captured during a 1:1 at the note that now records it. Anything for this
 * person that is still unlinked is picked up, so a session that was cut short is linked by the
 * next one. Returns how many records changed.
 */
export function linkToMeeting(
  engineerId: string,
  meeting: { id: string; createdAt: string },
  storage: DecisionStorage,
): Promise<number> {
  return enqueue(async () => {
    const meetingDate = new Date(meeting.createdAt);
    if (Number.isNaN(meetingDate.getTime())) throw new ValidationError('Meeting is not valid');
    const link = { linkedMeetingId: meeting.id, linkedMeetingDate: toIsoDate(meetingDate) };
    const previous = readRecords(storage);
    const isPending = (item: { engineerId: string; linkedMeetingId: string }) =>
      item.engineerId === engineerId && item.linkedMeetingId === '';
    const count =
      previous.decisions.filter(isPending).length + previous.followUps.filter(isPending).length;
    if (count === 0) return 0;
    await commit(storage, previous, {
      decisions: previous.decisions.map((item) => (isPending(item) ? { ...item, ...link } : item)),
      followUps: previous.followUps.map((item) => (isPending(item) ? { ...item, ...link } : item)),
    });
    return count;
  });
}

/** Whether the follow-up is pending and its due day is before today. Done ones are never overdue. */
export function isFollowUpOverdue(
  followUp: Pick<FollowUp, 'status' | 'dueDate'>,
  now: Date = new Date(),
): boolean {
  return (
    followUp.status === 'pending' &&
    followUp.dueDate !== undefined &&
    isPastDay(followUp.dueDate, now)
  );
}

/** Removes every decision and follow-up for a member, for when they leave the team. */
export function deleteDecisionsForMember(
  memberId: string,
  storage: DecisionStorage,
): Promise<void> {
  return enqueue(async () => {
    const previous = readRecords(storage);
    await commit(storage, previous, {
      decisions: previous.decisions.filter((item) => item.engineerId !== memberId),
      followUps: previous.followUps.filter((item) => item.engineerId !== memberId),
    });
  });
}
