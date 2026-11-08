import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';
import { seedId, seedMembers, type SeedMember } from './fixtures/seedMembers';

const pad = (value: number) => String(value).padStart(2, '0');

/** A local YYYY-MM-DD, `offsetDays` from today. */
const isoDay = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const member = (overrides: Partial<SeedMember> = {}): SeedMember => ({
  name: 'Alex Chen',
  role: 'Software Engineer',
  level: 'L4',
  status: 'active',
  startDate: '2023-03-13',
  ...overrides,
});

const scheduled = (nextDate: string): SeedMember['schedule'] => ({
  cadence: 'weekly',
  dayOfWeek: 'tuesday',
  time: '10:00',
  nextDate,
});

const openProfile = async (page: Page) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(0));
};

const openRoster = async (page: Page) => {
  await page.evaluate(() => window.location.assign('#/roster'));
  await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();
};

const expectNoViolations = async (page: Page) => {
  // Axe samples colours mid-fade otherwise.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const card = (page: Page) => page.getByRole('region', { name: '1:1 Schedule' });
const nextDate = (page: Page) => card(page).locator('time');

test.describe('1:1 schedule configuration', () => {
  test('manager sets up a 1:1 schedule and sees next date on profile', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [member()]);
    await openProfile(page);

    await expect(card(page)).toContainText('No 1:1 schedule set');
    await card(page).getByRole('button', { name: 'Set up schedule' }).click();
    await expect(page.getByLabel('Cadence')).toBeFocused();
    await page.getByLabel('Cadence').selectOption({ label: 'Biweekly' });
    await page.getByLabel('Day of week').selectOption({ label: 'Tuesday' });
    await page.getByLabel('Meeting time').fill('10:00');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(card(page)).toContainText('Every 2 weeks');
    await expect(card(page)).toContainText('Tuesdays at 10:00 AM');
    await expect(page.getByRole('status').filter({ hasText: 'Schedule saved' })).toBeAttached();
    await expect(card(page).getByRole('button', { name: 'Edit 1:1 schedule' })).toBeFocused();
    const next = await nextDate(page).getAttribute('datetime');
    expect(next! > isoDay(0)).toBe(true);
    await expect(card(page).getByText('Overdue')).toHaveCount(0);

    await expectNoViolations(page);
  });

  test('the schedule survives a reload', async ({ unlockedApp: page }) => {
    await seedMembers(page, [member()]);
    await openProfile(page);
    await card(page).getByRole('button', { name: 'Set up schedule' }).click();
    await page.getByLabel('Day of week').selectOption({ label: 'Thursday' });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(card(page)).toContainText('Thursdays at 10:00 AM');

    await page.reload();
    await page.getByLabel('Passphrase', { exact: true }).fill('correct horse battery staple');
    await page.getByRole('button', { name: 'Unlock' }).click();

    await expect(card(page)).toContainText('Every week');
    await expect(card(page)).toContainText('Thursdays at 10:00 AM');
  });

  test('configured schedule shows next 1:1 date in roster list', async ({ unlockedApp: page }) => {
    const date = isoDay(3);
    await seedMembers(page, [
      member({ schedule: scheduled(date) }),
      member({ name: 'Priya Nair', role: 'Engineering Manager', level: 'L6' }),
    ]);
    await openRoster(page);

    await expect(page.getByRole('columnheader', { name: 'Next 1:1' })).toBeVisible();
    const alex = page.getByTestId('member-row').filter({ hasText: 'Alex Chen' });
    await expect(alex.locator('time')).toHaveAttribute('datetime', date);
    await expect(alex).not.toContainText('Overdue');
    const priya = page.getByTestId('member-row').filter({ hasText: 'Priya Nair' });
    await expect(priya).toContainText('No 1:1 scheduled');
  });

  test('manager skips next 1:1 and date advances', async ({ unlockedApp: page }) => {
    const date = isoDay(3);
    await seedMembers(page, [member({ schedule: scheduled(date) })]);
    await openProfile(page);
    await expect(nextDate(page)).toHaveAttribute('datetime', date);

    await card(page).getByRole('button', { name: 'Skip next 1:1' }).click();

    await expect(nextDate(page)).not.toHaveAttribute('datetime', date);
    const advanced = await nextDate(page).getAttribute('datetime');
    expect(advanced! > date).toBe(true);
    await expect(page.getByRole('status').filter({ hasText: 'Next 1:1 skipped' })).toBeAttached();
  });

  test('manager reschedules the next 1:1 to a chosen date', async ({ unlockedApp: page }) => {
    await seedMembers(page, [member({ schedule: scheduled(isoDay(3)) })]);
    await openProfile(page);
    const moved = isoDay(5);

    await card(page).getByRole('button', { name: 'Reschedule' }).click();
    await expect(page.getByLabel('New date for next 1:1')).toBeFocused();
    await page.getByLabel('New date for next 1:1').fill(moved);
    await page.getByRole('button', { name: 'Confirm date' }).click();

    await expect(nextDate(page)).toHaveAttribute('datetime', moved);
    await expect(card(page).getByRole('button', { name: 'Reschedule' })).toBeFocused();
  });

  test('overdue 1:1 shows warning on profile and roster', async ({ unlockedApp: page }) => {
    const date = isoDay(-4);
    await seedMembers(page, [member({ schedule: scheduled(date) })]);
    await openProfile(page);

    await expect(nextDate(page)).toHaveAttribute('datetime', date);
    await expect(card(page).getByText('Overdue')).toBeVisible();
    await expect(card(page).locator('.next-one-on-one')).toHaveCSS('color', 'rgb(220, 38, 38)');
    await expectNoViolations(page);

    await openRoster(page);
    const row = page.getByTestId('member-row').filter({ hasText: 'Alex Chen' });
    await expect(row.getByText('Overdue')).toBeVisible();
    await expect(row.locator('.next-one-on-one')).toHaveCSS('color', 'rgb(220, 38, 38)');
  });
});
