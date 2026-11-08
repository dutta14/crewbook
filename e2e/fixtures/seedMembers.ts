import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, unlock } from './auth';

export interface SeedMember {
  name: string;
  role: string;
  level: string;
  status: 'active' | 'on_leave' | 'departing' | 'new_hire';
  startDate: string;
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
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
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
