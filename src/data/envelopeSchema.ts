import {
  bool,
  clockTime,
  collectionOf,
  dictionary,
  int,
  isoDate,
  listOf,
  literal,
  nullable,
  oneOf,
  optional,
  orEmpty,
  record,
  required,
  str,
  FieldIssue,
  type Check,
  type Shape,
} from '../utils/schemaCheck';

/**
 * The one list of everything the app keeps inside its two encrypted envelopes. Backups, restores
 * and the "what is in this file" summaries are all driven from it, so a new store is not part of a
 * backup until it is added here. A guard test fails when a store key is missing from this list.
 */

export type EnvelopeName = 'main' | 'private';

export interface EnvelopeEntry {
  key: string;
  envelope: EnvelopeName;
  check: Check<unknown>;
  /** How many records the value holds, for the summaries. */
  count: (value: unknown) => number;
}

export interface CountGroup {
  id: string;
  one: string;
  other: string;
  keys: readonly string[];
}

export const MAX_MEMBERS = 500;
export const MAX_RECORDS = 10_000;

const id = str({ min: 1, max: 100 });
const ref = str({ max: 100 });
const name = str({ max: 200 });
const title = str({ min: 1, max: 200 });
const text = (max: number) => str({ max, multiline: true });
const optionalDate = optional(isoDate);

const FIELD_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
const FIELD_ID_PATTERN = /^[A-Za-z0-9_-]{1,50}$/;
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const AVATAR_PATTERN = /^(https?:\/\/\S+|data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+)$/;
const HTTP_URL_PATTERN = /^https?:\/\/\S+$/i;

const listOfRecords = <T extends object>(label: string, shape: Shape<T>, max = MAX_RECORDS) =>
  collectionOf(label, record<T>(shape), max);

const arrayCount = (value: unknown) => (Array.isArray(value) ? value.length : 0);
const keyCount = (value: unknown) =>
  typeof value === 'object' && value !== null ? Object.keys(value).length : 0;
const noCount = () => 0;

const memberShape = {
  id: required(id),
  name: required(str({ min: 1, max: 200, noHtml: true })),
  role: required(str({ max: 200, noHtml: true })),
  level: required(str({ max: 200, noHtml: true })),
  startDate: required(isoDate),
  email: required((value: unknown) => {
    const email = str({ max: 254, noHtml: true })(value);
    if (email !== '' && !EMAIL_PATTERN.test(email)) throw new FieldIssue('');
    return email;
  }),
  manager: required(nullable(id)),
  status: required(oneOf(['active', 'on_leave', 'departing', 'new_hire'] as const)),
  departureDate: optionalDate,
  avatarUrl: optional(str({ max: 2048, pattern: AVATAR_PATTERN })),
  customFields: required(
    dictionary(
      str({ min: 1, max: 50, pattern: FIELD_KEY_PATTERN }),
      str({ max: 1000, noHtml: true }),
      20,
    ),
  ),
  schedule: optional(
    record({
      cadence: required(oneOf(['weekly', 'biweekly', 'monthly', 'custom'] as const)),
      dayOfWeek: required(oneOf(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const)),
      time: required(clockTime),
      customIntervalDays: optional(int(1, 365)),
      nextDate: required(isoDate),
      overrideDate: optionalDate,
    }),
  ),
  createdAt: required(isoDate),
  updatedAt: required(isoDate),
  history: optional(
    listOf(
      record({
        id: required(id),
        date: required(isoDate),
        field: required(
          oneOf([
            'name',
            'role',
            'level',
            'startDate',
            'email',
            'manager',
            'status',
            'customFields',
          ] as const),
        ),
        from: optional(str({ max: 2000 })),
        to: optional(str({ max: 2000 })),
      }),
      100,
    ),
  ),
};

const noteShape = (side: 'shared' | 'private') => ({
  id: required(id),
  memberId: required(ref),
  content: required(text(10_000)),
  createdAt: required(isoDate),
  updatedAt: required(isoDate),
  visibility: optional(literal(side)),
});

const SETTING_BOOLEAN = oneOf(['true', 'false'] as const);

const leadTimes = record({
  visa_expiry: required(int(1, 90)),
  probation_end: required(int(1, 90)),
  anniversary: required(int(1, 90)),
  birthday: required(int(1, 90)),
});

/** Lead times are stored as a JSON string inside the settings, so the string is checked deeply. */
const leadTimesText: Check<string> = (value) => {
  const raw = str({ max: 200 })(value);
  try {
    leadTimes(JSON.parse(raw));
  } catch {
    throw new FieldIssue('');
  }
  return raw;
};

const settingsShape = {
  moodTrackingEnabled: optional(SETTING_BOOLEAN),
  hideRiskIndicators: optional(SETTING_BOOLEAN),
  liveModeShortcuts: optional(SETTING_BOOLEAN),
  liveModeNoticeDismissed: optional(SETTING_BOOLEAN),
  managerName: optional(str({ max: 200 })),
  defaultNoteVisibility: optional(oneOf(['shared', 'private'] as const)),
  reminderLeadTimes: optional(leadTimesText),
  lastBackupAt: optionalDate,
};

/** The settings a backup carries. Anything else found in a stored settings object is left out. */
export const SETTING_KEYS: readonly string[] = Object.keys(settingsShape);

const settingsCheck = record(settingsShape);

export const ENVELOPE_ENTRIES: readonly EnvelopeEntry[] = [
  {
    key: 'members',
    envelope: 'main',
    check: listOfRecords('team members', memberShape, MAX_MEMBERS),
    count: arrayCount,
  },
  { key: 'settings', envelope: 'main', check: settingsCheck, count: noCount },
  {
    key: 'sharedNotes',
    envelope: 'main',
    check: listOfRecords('shared notes', noteShape('shared')),
    count: arrayCount,
  },
  {
    key: 'shareTokens',
    envelope: 'main',
    check: listOfRecords('link records', {
      id: required(id),
      engineerId: required(ref),
      createdAt: required(isoDate),
      expiresAt: required(isoDate),
      revoked: required(bool),
      ttl: required(oneOf(['1h', '6h', '24h', '48h'] as const)),
    }),
    count: noCount,
  },
  {
    key: 'customFieldDefinitions',
    envelope: 'main',
    check: listOfRecords(
      'custom fields',
      {
        id: required(str({ min: 1, max: 50, pattern: FIELD_ID_PATTERN })),
        name: required(str({ min: 1, max: 50, noHtml: true })),
        type: required(oneOf(['text', 'date', 'select', 'url'] as const)),
        options: optional(listOf(str({ min: 1, max: 100, noHtml: true }), 50)),
        order: required(int(0, 1000)),
      },
      10,
    ),
    count: arrayCount,
  },
  {
    key: 'notes',
    envelope: 'private',
    check: listOfRecords('private notes', noteShape('private')),
    count: arrayCount,
  },
  {
    key: 'noteDrafts',
    envelope: 'private',
    check: dictionary(id, text(10_000), MAX_RECORDS),
    count: keyCount,
  },
  {
    key: 'actionItems',
    envelope: 'private',
    check: listOfRecords('action items', {
      id: required(id),
      memberId: required(ref),
      noteId: optional(ref),
      title: required(title),
      ownerId: required(ref),
      ownerName: required(name),
      dueDate: optionalDate,
      status: required(oneOf(['open', 'done', 'cancelled'] as const)),
      includeInShare: optional(bool),
      createdAt: required(isoDate),
      updatedAt: required(isoDate),
    }),
    count: arrayCount,
  },
  {
    key: 'moods',
    envelope: 'private',
    check: listOfRecords('mood entries', {
      id: required(id),
      memberId: required(ref),
      noteId: required(ref),
      score: required(int(1, 5) as Check<1 | 2 | 3 | 4 | 5>),
      recordedAt: required(isoDate),
    }),
    count: arrayCount,
  },
  {
    key: 'decisions',
    envelope: 'private',
    check: listOfRecords('decisions', {
      id: required(id),
      engineerId: required(ref),
      title: required(title),
      context: required(text(2000)),
      date: required(isoDate),
      linkedMeetingId: required(ref),
      linkedMeetingDate: required(orEmpty(isoDate)),
      createdAt: required(isoDate),
    }),
    count: arrayCount,
  },
  {
    key: 'followUps',
    envelope: 'private',
    check: listOfRecords('follow-ups', {
      id: required(id),
      engineerId: required(ref),
      title: required(title),
      ownerId: required(ref),
      ownerName: required(name),
      dueDate: optionalDate,
      status: required(oneOf(['pending', 'done'] as const)),
      linkedMeetingId: required(ref),
      linkedMeetingDate: required(orEmpty(isoDate)),
      createdAt: required(isoDate),
    }),
    count: arrayCount,
  },
  {
    key: 'todos',
    envelope: 'private',
    check: listOfRecords('to-dos', {
      id: required(id),
      title: required(title),
      description: optional(text(5000)),
      dueDate: optionalDate,
      priority: required(oneOf(['low', 'medium', 'high'] as const)),
      status: required(oneOf(['todo', 'in_progress', 'done'] as const)),
      linkedPersonId: optional(ref),
      linkedPersonName: optional(name),
      createdAt: required(isoDate),
    }),
    count: arrayCount,
  },
  {
    key: 'reminders',
    envelope: 'private',
    check: listOfRecords('reminders', {
      id: required(id),
      text: required(text(500)),
      linkedPersonId: required(ref),
      linkedPersonName: required(name),
      triggerType: required(oneOf(['next_1on1', 'specific_date'] as const)),
      triggerDate: optionalDate,
      status: required(oneOf(['active', 'snoozed', 'dismissed'] as const)),
      snoozedUntil: optionalDate,
      createdAt: required(isoDate),
      dismissedAt: optionalDate,
    }),
    count: arrayCount,
  },
  {
    key: 'dateEvents',
    envelope: 'private',
    check: listOfRecords('key dates', {
      engineerId: required(ref),
      type: required(oneOf(['visa_expiry', 'probation_end', 'anniversary', 'birthday'] as const)),
      date: optionalDate,
    }),
    count: arrayCount,
  },
  {
    key: 'leave',
    envelope: 'private',
    check: listOfRecords('leave entries', {
      id: required(id),
      memberId: required(ref),
      type: required(oneOf(['pto', 'sick', 'personal', 'parental'] as const)),
      startDate: required(isoDate),
      endDate: required(isoDate),
      createdAt: required(isoDate),
    }),
    count: arrayCount,
  },
  {
    key: 'growth',
    envelope: 'private',
    check: listOfRecords('growth entries', {
      id: required(id),
      engineerId: required(ref),
      date: required(isoDate),
      changeType: required(
        oneOf(['promotion', 'role_change', 'team_transfer', 'title_update'] as const),
      ),
      from: required(text(500)),
      to: required(text(500)),
      notes: required(text(500)),
      createdAt: required(isoDate),
      updatedAt: required(isoDate),
    }),
    count: arrayCount,
  },
  {
    key: 'flightRisk',
    envelope: 'private',
    check: listOfRecords('risk notes', {
      id: required(id),
      engineerId: required(ref),
      text: required(text(2000)),
      flightRisk: required(oneOf(['none', 'low', 'medium', 'high'] as const)),
      createdAt: required(isoDate),
    }),
    count: arrayCount,
  },
  {
    key: 'feedback',
    envelope: 'private',
    check: listOfRecords('feedback entries', {
      id: required(id),
      engineerId: required(ref),
      date: required(isoDate),
      type: required(oneOf(['positive', 'constructive', 'neutral'] as const)),
      text: required(text(5000)),
      tags: required(listOf(str({ max: 50 }), 10)),
      createdAt: required(isoDate),
      updatedAt: required(isoDate),
    }),
    count: arrayCount,
  },
  {
    key: 'skills',
    envelope: 'private',
    check: listOfRecords('skills', {
      id: required(id),
      memberId: required(ref),
      name: required(str({ min: 1, max: 100 })),
      level: required(oneOf(['learning', 'competent', 'proficient', 'expert'] as const)),
      category: required(oneOf(['strength', 'growth'] as const)),
      notes: required(text(500)),
      visibility: required(literal('private')),
      createdAt: required(isoDate),
      updatedAt: required(isoDate),
    }),
    count: arrayCount,
  },
  {
    key: 'connections',
    envelope: 'private',
    check: listOfRecords('connections', {
      id: required(id),
      sourceMemberId: required(ref),
      targetMemberId: required(nullable(ref)),
      targetName: required(str({ max: 100 })),
      relationship: required(oneOf(['collaborator', 'mentor', 'mentee', 'stakeholder'] as const)),
      notes: optional(text(500)),
    }),
    count: arrayCount,
  },
  {
    key: 'documentLinks',
    envelope: 'private',
    check: listOfRecords('document links', {
      id: required(id),
      memberId: required(ref),
      title: required(title),
      url: required(str({ min: 1, max: 2048, pattern: HTTP_URL_PATTERN })),
      category: required(
        oneOf(['promo_packet', 'self_review', 'career_ladder', 'idp', 'other'] as const),
      ),
      visibility: required(literal('private')),
      createdAt: required(isoDate),
      updatedAt: required(isoDate),
    }),
    count: arrayCount,
  },
  {
    key: 'agendaItems',
    envelope: 'private',
    check: listOfRecords('agenda items', {
      id: required(id),
      memberId: required(ref),
      text: required(text(500)),
      addedBy: required(oneOf(['manager', 'engineer'] as const)),
      createdAt: required(isoDate),
      includeInShare: optional(bool),
      discussed: optional(bool),
      archived: optional(bool),
      archivedAt: optionalDate,
    }),
    count: arrayCount,
  },
];

export const ENVELOPE_KEYS: readonly string[] = ENVELOPE_ENTRIES.map((entry) => entry.key);

const entryByKey = new Map(ENVELOPE_ENTRIES.map((entry) => [entry.key, entry]));

export function getEnvelopeEntry(key: string): EnvelopeEntry | undefined {
  return entryByKey.get(key);
}

export function keysOf(envelope: EnvelopeName): string[] {
  return ENVELOPE_ENTRIES.filter((entry) => entry.envelope === envelope).map((entry) => entry.key);
}

/** The categories shown to the person in previews, in the order they appear. */
export const COUNT_GROUPS: readonly CountGroup[] = [
  { id: 'members', one: 'team member', other: 'team members', keys: ['members'] },
  { id: 'notes', one: 'note', other: 'notes', keys: ['notes', 'sharedNotes'] },
  { id: 'actionItems', one: 'action item', other: 'action items', keys: ['actionItems'] },
  { id: 'agendaItems', one: 'agenda item', other: 'agenda items', keys: ['agendaItems'] },
  { id: 'decisions', one: 'decision', other: 'decisions', keys: ['decisions'] },
  { id: 'followUps', one: 'follow-up', other: 'follow-ups', keys: ['followUps'] },
  { id: 'todos', one: 'to-do', other: 'to-dos', keys: ['todos'] },
  { id: 'reminders', one: 'reminder', other: 'reminders', keys: ['reminders'] },
  { id: 'dateEvents', one: 'key date', other: 'key dates', keys: ['dateEvents'] },
  { id: 'leave', one: 'leave entry', other: 'leave entries', keys: ['leave'] },
  { id: 'moods', one: 'mood entry', other: 'mood entries', keys: ['moods'] },
  { id: 'growth', one: 'growth entry', other: 'growth entries', keys: ['growth'] },
  { id: 'flightRisk', one: 'risk note', other: 'risk notes', keys: ['flightRisk'] },
  { id: 'feedback', one: 'feedback entry', other: 'feedback entries', keys: ['feedback'] },
  { id: 'skills', one: 'skill', other: 'skills', keys: ['skills'] },
  { id: 'connections', one: 'connection', other: 'connections', keys: ['connections'] },
  { id: 'documentLinks', one: 'document link', other: 'document links', keys: ['documentLinks'] },
  { id: 'noteDrafts', one: 'note draft', other: 'note drafts', keys: ['noteDrafts'] },
  {
    id: 'customFieldDefinitions',
    one: 'custom field',
    other: 'custom fields',
    keys: ['customFieldDefinitions'],
  },
];

export interface CountLine {
  id: string;
  count: number;
  label: string;
}

/** Counts per category; with `privateOnly`, only records that live in the private envelope. */
export function countRecords(
  data: Readonly<Record<string, unknown>>,
  privateOnly = false,
): CountLine[] {
  const lines: CountLine[] = [];
  for (const group of COUNT_GROUPS) {
    let count = 0;
    for (const key of group.keys) {
      const entry = entryByKey.get(key);
      if (!entry || (privateOnly && entry.envelope !== 'private')) continue;
      count += entry.count(data[key]);
    }
    lines.push({ id: group.id, count, label: count === 1 ? group.one : group.other });
  }
  return lines;
}
