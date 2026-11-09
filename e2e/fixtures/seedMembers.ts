import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, unlock } from './auth';

export interface SeedMember {
  name: string;
  role: string;
  level: string;
  status: 'active' | 'on_leave' | 'departing' | 'new_hire';
  startDate: string;
  /** YYYY-MM-DD; only meaningful for a departing member. */
  departureDate?: string;
  email?: string;
  /** Index into the seeded list of this member's manager. */
  managerIndex?: number;
  customFields?: Record<string, string>;
  schedule?: {
    cadence: 'weekly' | 'biweekly' | 'monthly' | 'custom';
    dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
    time: string;
    customIntervalDays?: number;
    /** YYYY-MM-DD */
    nextDate: string;
    overrideDate?: string;
  };
  /** Recorded edits, oldest first; seeds the status changes the prep card reports. */
  history?: Array<{
    id: string;
    date: string;
    field: 'status';
    from: SeedMember['status'];
    to: SeedMember['status'];
  }>;
}

/** Profile routes only accept UUIDs, so seeded ids are well-formed ones. */
export const seedId = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

/**
 * Writes members into the encrypted store through the same StorageManager the app uses, then
 * reloads and unlocks so the running app reads them. Needs a page that is already set up.
 */
export async function seedMembers(page: Page, members: SeedMember[], passphrase = TEST_PASSPHRASE) {
  const stored = members.map(({ managerIndex, email, customFields, ...member }, index) => ({
    ...member,
    id: seedId(index),
    email: email ?? `seed-${index}@example.com`,
    manager: managerIndex === undefined ? null : seedId(managerIndex),
    customFields: customFields ?? {},
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }));
  await page.evaluate(
    async ({ data, secret }) => {
      // A variable specifier keeps TypeScript from resolving the browser-only dev-server path.
      const modulePath = '/src/data/StorageManager.ts';
      const { StorageManager } = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import('../../src/data/StorageManager');
      const manager = new StorageManager();
      await manager.unlock(secret);
      manager.setData('members', data);
      const failure = await manager.flush();
      if (failure) throw failure;
      await manager.lock();
    },
    { data: stored, secret: passphrase },
  );
  await page.reload();
  await unlock(page, passphrase);
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
  ).toBeVisible();
}

export interface SeedNote {
  /** Index into the seeded list of members. */
  memberIndex: number;
  content: string;
  /** How long before now the note was written. */
  hoursAgo: number;
  /** Only 'shared' notes can appear in a share link. Omit for a private note. */
  visibility?: 'shared' | 'private';
}

/**
 * Writes 1:1 notes the way the app stores them: shared notes in the main envelope, everything
 * else in the private one. Seed members first, then call this.
 */
export async function seedNotes(page: Page, notes: SeedNote[], passphrase = TEST_PASSPHRASE) {
  const now = Date.now();
  const stored = notes.map(({ memberIndex, content, hoursAgo, visibility }, index) => {
    const at = new Date(now - hoursAgo * 60 * 60 * 1000).toISOString();
    return {
      id: `00000000-0000-4000-9000-${String(index).padStart(12, '0')}`,
      memberId: seedId(memberIndex),
      content,
      createdAt: at,
      updatedAt: at,
      visibility: visibility ?? 'private',
    };
  });
  await page.evaluate(
    async ({ data, secret }) => {
      const modulePath = '/src/data/StorageManager.ts';
      const { StorageManager } = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import('../../src/data/StorageManager');
      const manager = new StorageManager();
      await manager.unlock(secret);
      await manager.loadPrivate();
      manager.setPrivateData(
        'notes',
        data.filter((note) => note.visibility !== 'shared'),
      );
      manager.setData(
        'sharedNotes',
        data.filter((note) => note.visibility === 'shared'),
      );
      const failure = await manager.flush();
      if (failure) throw failure;
      await manager.lock();
    },
    { data: stored, secret: passphrase },
  );
  await page.reload();
  await unlock(page, passphrase);
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
  ).toBeVisible();
}

export interface SeedActionItem {
  /** Index into the seeded list of members. */
  memberIndex: number;
  title: string;
  /** Days from today; negative is overdue. Omit for no due date. */
  dueInDays?: number;
  status?: 'open' | 'done' | 'cancelled';
  /** Defaults to the manager. The engineer is the person at `memberIndex`. */
  owner?: 'manager' | 'engineer';
  includeInShare?: boolean;
}

export const isoDateInDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Today's date, a whole number of years back, e.g. for an anniversary or birthday that is today. */
export const isoDateYearsAgo = (years: number) =>
  `${Number(isoDateInDays(0).slice(0, 4)) - years}${isoDateInDays(0).slice(4)}`;

/** Writes action items, owned by the manager, into the private envelope. Seed members first. */
export async function seedActionItems(
  page: Page,
  items: SeedActionItem[],
  passphrase = TEST_PASSPHRASE,
) {
  const at = new Date().toISOString();
  const stored = items.map(
    ({ memberIndex, title, dueInDays, status, owner, includeInShare }, index) => ({
      id: `00000000-0000-4000-a000-${String(index).padStart(12, '0')}`,
      memberId: seedId(memberIndex),
      title,
      ownerId: owner === 'engineer' ? seedId(memberIndex) : 'manager',
      ownerName: owner === 'engineer' ? SEED_TEAM[memberIndex].name : 'Me',
      ...(dueInDays === undefined ? {} : { dueDate: isoDateInDays(dueInDays) }),
      status: status ?? 'open',
      ...(includeInShare === undefined ? {} : { includeInShare }),
      createdAt: at,
      updatedAt: at,
    }),
  );
  await page.evaluate(
    async ({ data, secret }) => {
      const modulePath = '/src/data/StorageManager.ts';
      const { StorageManager } = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import('../../src/data/StorageManager');
      const manager = new StorageManager();
      await manager.unlock(secret);
      await manager.loadPrivate();
      manager.setPrivateData('actionItems', data);
      const failure = await manager.flush();
      if (failure) throw failure;
      await manager.lock();
    },
    { data: stored, secret: passphrase },
  );
  await page.reload();
  await unlock(page, passphrase);
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
  ).toBeVisible();
}

export interface SeedDecision {
  memberIndex: number;
  title: string;
  context?: string;
}

export interface SeedFollowUp {
  memberIndex: number;
  title: string;
  /** Days from today; negative is in the past. */
  dueInDays?: number;
  status?: 'pending' | 'done';
}

/** Records are created in order, so later entries are newer and listed first. */
export async function seedDecisions(
  page: Page,
  records: { decisions?: SeedDecision[]; followUps?: SeedFollowUp[] },
  passphrase = TEST_PASSPHRASE,
) {
  const base = Date.now() - 60_000;
  let tick = 0;
  const stamp = () => new Date(base + tick++ * 1000).toISOString();
  const decisions = (records.decisions ?? []).map(({ memberIndex, title, context }, index) => ({
    id: `00000000-0000-4000-b000-${String(index).padStart(12, '0')}`,
    engineerId: seedId(memberIndex),
    title,
    context: context ?? '',
    date: isoDateInDays(0),
    linkedMeetingId: '',
    linkedMeetingDate: '',
    createdAt: stamp(),
  }));
  const followUps = (records.followUps ?? []).map(
    ({ memberIndex, title, dueInDays, status }, index) => ({
      id: `00000000-0000-4000-c000-${String(index).padStart(12, '0')}`,
      engineerId: seedId(memberIndex),
      title,
      ownerId: 'manager',
      ownerName: 'Me',
      ...(dueInDays === undefined ? {} : { dueDate: isoDateInDays(dueInDays) }),
      status: status ?? 'pending',
      linkedMeetingId: '',
      linkedMeetingDate: '',
      createdAt: stamp(),
    }),
  );
  await page.evaluate(
    async ({ decisionData, followUpData, secret }) => {
      const modulePath = '/src/data/StorageManager.ts';
      const { StorageManager } = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import('../../src/data/StorageManager');
      const manager = new StorageManager();
      await manager.unlock(secret);
      await manager.loadPrivate();
      manager.setPrivateData('decisions', decisionData);
      manager.setPrivateData('followUps', followUpData);
      const failure = await manager.flush();
      if (failure) throw failure;
      await manager.lock();
    },
    { decisionData: decisions, followUpData: followUps, secret: passphrase },
  );
  await page.reload();
  await unlock(page, passphrase);
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
  ).toBeVisible();
}

export interface SeedGrowthEntry {
  memberIndex: number;
  /** ISO date (YYYY-MM-DD) the change took effect. */
  date: string;
  changeType: 'promotion' | 'role_change' | 'title_update' | 'team_transfer';
  from?: string;
  to?: string;
  notes?: string;
}

/** Writes growth entries into the private encrypted envelope. Seed members first. */
export async function seedGrowth(
  page: Page,
  entries: SeedGrowthEntry[],
  passphrase = TEST_PASSPHRASE,
) {
  const base = Date.now() - 60_000;
  const stored = entries.map(({ memberIndex, date, changeType, from, to, notes }, index) => ({
    id: `00000000-0000-4000-d000-${String(index).padStart(12, '0')}`,
    engineerId: seedId(memberIndex),
    date,
    changeType,
    from: from ?? '',
    to: to ?? '',
    notes: notes ?? '',
    createdAt: new Date(base + index * 1000).toISOString(),
    updatedAt: new Date(base + index * 1000).toISOString(),
  }));
  await page.evaluate(
    async ({ data, secret }) => {
      const modulePath = '/src/data/StorageManager.ts';
      const { StorageManager } = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import('../../src/data/StorageManager');
      const manager = new StorageManager();
      await manager.unlock(secret);
      await manager.loadPrivate();
      manager.setPrivateData('growth', data);
      const failure = await manager.flush();
      if (failure) throw failure;
      await manager.lock();
    },
    { data: stored, secret: passphrase },
  );
  await page.reload();
  await unlock(page, passphrase);
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
  ).toBeVisible();
}

export interface SeedFeedback {
  memberIndex: number;
  /** ISO date (YYYY-MM-DD) of the observation. */
  date: string;
  type: 'positive' | 'constructive' | 'neutral';
  text: string;
  tags?: string[];
}

/** Writes feedback entries into the private encrypted envelope. Seed members first. */
export async function seedFeedback(
  page: Page,
  entries: SeedFeedback[],
  passphrase = TEST_PASSPHRASE,
) {
  const base = Date.now() - 60_000;
  const stored = entries.map(({ memberIndex, date, type, text, tags }, index) => ({
    id: `00000000-0000-4000-f000-${String(index).padStart(12, '0')}`,
    engineerId: seedId(memberIndex),
    date,
    type,
    text,
    tags: tags ?? [],
    createdAt: new Date(base + index * 1000).toISOString(),
    updatedAt: new Date(base + index * 1000).toISOString(),
  }));
  await page.evaluate(
    async ({ data, secret }) => {
      const modulePath = '/src/data/StorageManager.ts';
      const { StorageManager } = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import('../../src/data/StorageManager');
      const manager = new StorageManager();
      await manager.unlock(secret);
      await manager.loadPrivate();
      manager.setPrivateData('feedback', data);
      const failure = await manager.flush();
      if (failure) throw failure;
      await manager.lock();
    },
    { data: stored, secret: passphrase },
  );
  await page.reload();
  await unlock(page, passphrase);
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
  ).toBeVisible();
}

export interface SeedMood {
  /** Index into the seeded list of members. */
  memberIndex: number;
  score: 1 | 2 | 3 | 4 | 5;
  /** How many days before today the 1:1 happened. */
  daysAgo: number;
}

/** Writes mood ratings into the private encrypted envelope. Seed members first. */
export async function seedMoods(page: Page, moods: SeedMood[], passphrase = TEST_PASSPHRASE) {
  const now = Date.now();
  const stored = moods.map(({ memberIndex, score, daysAgo }, index) => ({
    id: `00000000-0000-4000-b000-${String(index).padStart(12, '0')}`,
    memberId: seedId(memberIndex),
    noteId: `00000000-0000-4000-9000-${String(index).padStart(12, '0')}`,
    score,
    recordedAt: new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  }));
  await page.evaluate(
    async ({ data, secret }) => {
      const modulePath = '/src/data/StorageManager.ts';
      const { StorageManager } = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import('../../src/data/StorageManager');
      const manager = new StorageManager();
      await manager.unlock(secret);
      await manager.loadPrivate();
      manager.setPrivateData('moods', data);
      const failure = await manager.flush();
      if (failure) throw failure;
      await manager.lock();
    },
    { data: stored, secret: passphrase },
  );
  await page.reload();
  await unlock(page, passphrase);
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
  ).toBeVisible();
}

export interface SeedAgendaItem {
  /** Index into the seeded list of members. */
  memberIndex: number;
  text: string;
  addedBy: 'manager' | 'engineer';
  includeInShare?: boolean;
}

/** Writes agenda topics into the private envelope. Seed members first. */
export async function seedAgenda(
  page: Page,
  items: SeedAgendaItem[],
  passphrase = TEST_PASSPHRASE,
) {
  const at = new Date().toISOString();
  const stored = items.map(({ memberIndex, ...item }, index) => ({
    id: `00000000-0000-4000-c000-${String(index).padStart(12, '0')}`,
    memberId: seedId(memberIndex),
    createdAt: at,
    ...item,
  }));
  await page.evaluate(
    async ({ data, secret }) => {
      const modulePath = '/src/data/StorageManager.ts';
      const { StorageManager } = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import('../../src/data/StorageManager');
      const manager = new StorageManager();
      await manager.unlock(secret);
      await manager.loadPrivate();
      manager.setPrivateData('agendaItems', data);
      const failure = await manager.flush();
      if (failure) throw failure;
      await manager.lock();
    },
    { data: stored, secret: passphrase },
  );
  await page.reload();
  await unlock(page, passphrase);
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
  ).toBeVisible();
}

export const SEED_TEAM: SeedMember[] = [
  {
    name: 'Alice Park',
    role: 'Staff Engineer',
    level: 'L6',
    status: 'active',
    startDate: '2019-04-01',
  },
  {
    name: 'Bob Singh',
    role: 'Product Designer',
    level: 'L4',
    status: 'on_leave',
    startDate: '2022-09-12',
  },
  {
    name: 'Carmen Diaz',
    role: 'Engineer',
    level: 'L3',
    status: 'departing',
    startDate: '2021-01-20',
  },
  {
    name: 'Dev Patel',
    role: 'Software Engineer',
    level: 'L2',
    status: 'new_hire',
    startDate: '2099-06-15',
  },
];

export interface SeedTodo {
  title: string;
  /** Days from today; negative is overdue. Omit for no due date. */
  dueInDays?: number;
  priority?: 'high' | 'medium' | 'low';
  status?: 'todo' | 'in_progress' | 'done';
  /** Index into the seeded list of members. */
  memberIndex?: number;
}

/** Writes personal tasks into the private envelope. Seed members first when linking people. */
export async function seedTodos(page: Page, todos: SeedTodo[], passphrase = TEST_PASSPHRASE) {
  const at = new Date().toISOString();
  const stored = todos.map(({ title, dueInDays, priority, status, memberIndex }, index) => ({
    id: `00000000-0000-4000-c000-${String(index).padStart(12, '0')}`,
    title,
    ...(dueInDays === undefined ? {} : { dueDate: isoDateInDays(dueInDays) }),
    priority: priority ?? 'medium',
    status: status ?? 'todo',
    ...(memberIndex === undefined ? {} : { linkedPersonId: seedId(memberIndex) }),
    createdAt: at,
  }));
  await page.evaluate(
    async ({ data, secret }) => {
      const modulePath = '/src/data/StorageManager.ts';
      const { StorageManager } = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import('../../src/data/StorageManager');
      const manager = new StorageManager();
      await manager.unlock(secret);
      await manager.loadPrivate();
      manager.setPrivateData('todos', data);
      const failure = await manager.flush();
      if (failure) throw failure;
      await manager.lock();
    },
    { data: stored, secret: passphrase },
  );
  await page.reload();
  await unlock(page, passphrase);
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
  ).toBeVisible();
}

export interface SeedLeave {
  /** Index into the seeded list of members. */
  memberIndex: number;
  type: 'pto' | 'sick' | 'personal' | 'parental';
  /** Days from today, inclusive. */
  startInDays: number;
  endInDays: number;
}

/** Writes leave into the private envelope. Seed members first. */
export async function seedLeave(page: Page, leave: SeedLeave[], passphrase = TEST_PASSPHRASE) {
  const at = new Date().toISOString();
  const stored = leave.map(({ memberIndex, type, startInDays, endInDays }, index) => ({
    id: `00000000-0000-4000-e000-${String(index).padStart(12, '0')}`,
    memberId: seedId(memberIndex),
    type,
    startDate: isoDateInDays(startInDays),
    endDate: isoDateInDays(endInDays),
    createdAt: at,
  }));
  await page.evaluate(
    async ({ data, secret }) => {
      const modulePath = '/src/data/StorageManager.ts';
      const { StorageManager } = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import('../../src/data/StorageManager');
      const manager = new StorageManager();
      await manager.unlock(secret);
      await manager.loadPrivate();
      manager.setPrivateData('leave', data);
      const failure = await manager.flush();
      if (failure) throw failure;
      await manager.lock();
    },
    { data: stored, secret: passphrase },
  );
  await page.reload();
  await unlock(page, passphrase);
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
  ).toBeVisible();
}

export interface SeedDateEvent {
  /** Index into the seeded list of members. */
  memberIndex: number;
  type: 'visa_expiry' | 'probation_end' | 'birthday';
  /** YYYY-MM-DD */
  date: string;
}

/** Writes key dates into the private envelope. Seed members first, since each is about one. */
export async function seedDateEvents(
  page: Page,
  events: SeedDateEvent[],
  passphrase = TEST_PASSPHRASE,
) {
  const stored = events.map(({ memberIndex, type, date }) => ({
    engineerId: seedId(memberIndex),
    type,
    date,
  }));
  await page.evaluate(
    async ({ data, secret }) => {
      const modulePath = '/src/data/StorageManager.ts';
      const { StorageManager } = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import('../../src/data/StorageManager');
      const manager = new StorageManager();
      await manager.unlock(secret);
      await manager.loadPrivate();
      manager.setPrivateData('dateEvents', data);
      const failure = await manager.flush();
      if (failure) throw failure;
      await manager.lock();
    },
    { data: stored, secret: passphrase },
  );
  await page.reload();
  await unlock(page, passphrase);
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
  ).toBeVisible();
}

export interface SeedReminder {
  text: string;
  /** Index into the seeded list of members. */
  memberIndex: number;
  triggerType?: 'next_1on1' | 'specific_date';
  /** Days from today, for a specific-date reminder. */
  triggerInDays?: number;
  status?: 'active' | 'snoozed' | 'dismissed';
  /** Days from today; set while snoozed. */
  snoozedInDays?: number;
}

/** Writes reminders into the private envelope. Seed members first, since each is about one. */
export async function seedReminders(
  page: Page,
  reminders: SeedReminder[],
  members: SeedMember[],
  passphrase = TEST_PASSPHRASE,
) {
  const at = new Date().toISOString();
  const stored = reminders.map(
    (
      {
        text,
        memberIndex,
        triggerType = 'next_1on1',
        triggerInDays,
        status = 'active',
        snoozedInDays,
      },
      index,
    ) => ({
      id: `00000000-0000-4000-d000-${String(index).padStart(12, '0')}`,
      text,
      linkedPersonId: seedId(memberIndex),
      linkedPersonName: members[memberIndex].name,
      triggerType,
      ...(triggerType === 'specific_date'
        ? { triggerDate: isoDateInDays(triggerInDays ?? 0) }
        : {}),
      status,
      ...(snoozedInDays === undefined ? {} : { snoozedUntil: isoDateInDays(snoozedInDays) }),
      createdAt: at,
      ...(status === 'dismissed' ? { dismissedAt: at } : {}),
    }),
  );
  await page.evaluate(
    async ({ data, secret }) => {
      const modulePath = '/src/data/StorageManager.ts';
      const { StorageManager } = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import('../../src/data/StorageManager');
      const manager = new StorageManager();
      await manager.unlock(secret);
      await manager.loadPrivate();
      manager.setPrivateData('reminders', data);
      const failure = await manager.flush();
      if (failure) throw failure;
      await manager.lock();
    },
    { data: stored, secret: passphrase },
  );
  await page.reload();
  await unlock(page, passphrase);
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
  ).toBeVisible();
}
