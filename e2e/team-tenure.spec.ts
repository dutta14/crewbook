import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';
import { seedMembers, type SeedMember } from './fixtures/seedMembers';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const daysAgo = (days: number) => {
  const day = new Date();
  day.setDate(day.getDate() - days);
  const month = String(day.getMonth() + 1).padStart(2, '0');
  return `${day.getFullYear()}-${month}-${String(day.getDate()).padStart(2, '0')}`;
};

const TEAM: SeedMember[] = [
  {
    name: 'Alice Park',
    role: 'Staff Engineer',
    level: 'L6',
    status: 'active',
    startDate: '2019-04-01',
  },
  {
    name: 'Carmen Diaz',
    role: 'Engineer',
    level: 'L3',
    status: 'departing',
    startDate: '2021-01-20',
    departureDate: '2027-03-31',
  },
  {
    name: 'Bob Singh',
    role: 'Product Designer',
    level: 'L4',
    status: 'on_leave',
    startDate: '2022-09-12',
  },
  {
    name: 'Dev Patel',
    role: 'Software Engineer',
    level: 'L2',
    status: 'new_hire',
    startDate: daysAgo(30),
  },
];

const openTenure = async (page: Page) => {
  await page.getByRole('link', { name: 'Team', exact: true }).click();
  await page.getByRole('link', { name: 'Tenure timeline' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Team Tenure' })).toBeVisible();
};

const tableNames = (page: Page) => page.locator('table.sr-only tbody th');

test.describe('Team tenure', () => {
  test('explains that there is nothing to chart on a fresh install', async ({
    unlockedApp: page,
  }) => {
    await page.evaluate(() => {
      window.location.hash = '/team/tenure';
    });

    await expect(page.getByRole('heading', { level: 1, name: 'Team Tenure' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Add team members to see tenure data' }),
    ).toBeVisible();
    await expectNoViolations(page);
  });

  test('shows a status-coded bar for everyone, the average tenure and a text alternative', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, TEAM);
    await openTenure(page);

    await expect(page.getByRole('status', { name: /^Average team tenure:/ })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Team tenure timeline chart' })).toBeVisible();
    await expect(page.getByTestId('tenure-bar')).toHaveCount(4);
    await expect(page.locator('[data-status="active"]')).toHaveCount(1);
    await expect(page.locator('[data-status="on_leave"]')).toHaveCount(1);
    await expect(page.locator('[data-status="new_hire"]')).toHaveCount(1);
    await expect(page.locator('[data-status="departing"]')).toHaveCount(1);
    await expect(page.getByTestId('tenure-end-cap')).toHaveCount(1);
    await expect(page.locator('[data-status="new_hire"] rect')).toHaveAttribute(
      'stroke-dasharray',
      '4 3',
    );
    await expect(page.getByTestId('tenure-today-marker')).toHaveText('Today');

    const rows = page.locator('table.sr-only tbody tr');
    await expect(rows).toHaveCount(4);
    await expect(rows.filter({ hasText: 'Carmen Diaz' })).toContainText('Mar 31, 2027');
    await expect(rows.filter({ hasText: 'Carmen Diaz' })).toContainText('Departing');
    await expectNoViolations(page);
  });

  test('re-sorts by start date, tenure length and name', async ({ unlockedApp: page }) => {
    await seedMembers(page, TEAM);
    await openTenure(page);
    const sort = page.getByLabel('Sort by');

    await expect(sort).toHaveValue('startDate');
    await expect(tableNames(page)).toHaveText([
      'Alice Park',
      'Carmen Diaz',
      'Bob Singh',
      'Dev Patel',
    ]);

    await sort.selectOption('name');
    await expect(tableNames(page)).toHaveText([
      'Alice Park',
      'Bob Singh',
      'Carmen Diaz',
      'Dev Patel',
    ]);

    await sort.selectOption('tenureLength');
    await expect(tableNames(page)).toHaveText([
      'Alice Park',
      'Carmen Diaz',
      'Bob Singh',
      'Dev Patel',
    ]);

    expect(page.url()).not.toContain('sort');
    expect(await page.evaluate(() => window.localStorage.getItem('tenureSort'))).toBeNull();
  });

  test('shows a tooltip with name, tenure and start month while a bar is hovered', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, TEAM);
    await openTenure(page);

    await page.locator('[data-status="active"] rect').hover();
    await expect(page.getByRole('tooltip')).toContainText('Alice Park');
    await expect(page.getByRole('tooltip')).toContainText('(Start: Apr 2019)');
    await expect(page.getByRole('tooltip')).toContainText('Active');

    await page.getByRole('heading', { level: 1 }).hover();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });

  test('keeps names in view while the chart scrolls on a phone', async ({ unlockedApp: page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await seedMembers(page, TEAM);
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('link', { name: 'Team', exact: true }).click();
    await page.getByRole('link', { name: 'Tenure timeline' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Team Tenure' })).toBeVisible();

    const scroller = page.locator('.tenure-chart__scroll');
    expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    const labels = page.locator('.tenure-chart__labels');
    const before = await labels.boundingBox();
    await scroller.evaluate((el) => el.scrollTo({ left: 200 }));
    const after = await labels.boundingBox();

    expect(after?.x).toBeCloseTo(before?.x ?? 0, 0);
    await expectNoViolations(page);
  });
});
