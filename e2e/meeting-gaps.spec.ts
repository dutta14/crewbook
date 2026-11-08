import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';
import { SEED_TEAM, seedId, seedMembers, seedNotes, type SeedMember } from './fixtures/seedMembers';

const HOURS_PER_DAY = 24;

const isoDay = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('-');
};

const weekly = (member: SeedMember): SeedMember => ({
  ...member,
  schedule: { cadence: 'weekly', dayOfWeek: 'monday', time: '10:00', nextDate: isoDay(3) },
});

const [ALICE, BOB, CARMEN] = SEED_TEAM.map(weekly);

const overdueCard = (page: Page) => page.getByRole('region', { name: 'Overdue 1:1s' });

const openProfile = async (page: Page, memberIndex = 0) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

test.describe('meeting history and gap alerts', () => {
  test('the roster flags a member who is overdue for a 1:1 with how long it has been', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [ALICE, BOB]);
    await seedNotes(page, [
      { memberIndex: 0, content: 'Long ago', hoursAgo: 14 * HOURS_PER_DAY },
      { memberIndex: 1, content: 'Recent', hoursAgo: 5 * HOURS_PER_DAY },
    ]);

    await page.getByRole('link', { name: 'Team' }).click();

    const aliceRow = page.getByTestId('member-row').filter({ hasText: 'Alice Park' });
    const bobRow = page.getByTestId('member-row').filter({ hasText: 'Bob Singh' });
    await expect(
      aliceRow.getByRole('img', { name: 'Overdue: last met 2 weeks ago' }),
    ).toBeVisible();
    await expect(aliceRow.getByRole('img')).toContainText('2 weeks');
    await expect(bobRow.getByRole('img')).toHaveCount(0);
  });

  test('the roster shows no badge when 1:1s are on schedule', async ({ unlockedApp: page }) => {
    await seedMembers(page, [ALICE]);
    await seedNotes(page, [{ memberIndex: 0, content: 'Recent', hoursAgo: 5 * HOURS_PER_DAY }]);

    await page.getByRole('link', { name: 'Team' }).click();

    await expect(page.getByTestId('member-row')).toHaveCount(1);
    await expect(page.getByRole('img', { name: /Overdue/ })).toHaveCount(0);
  });

  test('the dashboard lists who is overdue, most overdue first, and opens their profile', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [ALICE, BOB, CARMEN]);
    await seedNotes(page, [
      { memberIndex: 0, content: 'A', hoursAgo: 12 * HOURS_PER_DAY },
      { memberIndex: 1, content: 'B', hoursAgo: 20 * HOURS_PER_DAY },
      { memberIndex: 2, content: 'C', hoursAgo: 3 * HOURS_PER_DAY },
    ]);

    await expect(overdueCard(page).getByRole('heading', { level: 3 })).toHaveText('Overdue 1:1s');
    const rows = overdueCard(page).getByRole('link');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Bob Singh');
    await expect(rows.nth(0)).toContainText('Last met 20 days ago');
    await expect(rows.nth(1)).toContainText('Alice Park');
    await expect(rows.nth(1)).toContainText('Last met 12 days ago');
    await expectNoViolations(page);

    await rows.nth(1).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Alice Park' })).toBeVisible();
  });

  test('the dashboard says everyone is caught up when nobody is overdue', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [ALICE]);
    await seedNotes(page, [{ memberIndex: 0, content: 'Recent', hoursAgo: 2 * HOURS_PER_DAY }]);

    await expect(page.getByText('All clear today.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Overdue 1:1s' })).toHaveCount(0);
  });

  test('the Meetings tab shows stats and a history that links to the full note', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [ALICE]);
    await seedNotes(
      page,
      Array.from({ length: 12 }, (_, index) => ({
        memberIndex: 0,
        content: `Meeting number ${index + 1} covered planning`,
        hoursAgo: (index + 1) * HOURS_PER_DAY,
      })),
    );
    await openProfile(page);

    await page.getByRole('tab', { name: 'Meetings' }).click();

    const panel = page.getByRole('tabpanel', { name: 'Meetings' });
    await expect(panel.getByText('Total meetings')).toBeVisible();
    await expect(panel.locator('dd').first()).toHaveText('12');
    const history = panel.getByRole('list', { name: 'Meeting history' });
    await expect(history.getByRole('link')).toHaveCount(10);
    await panel.getByRole('button', { name: 'Show all 12 meetings' }).click();
    await expect(history.getByRole('link')).toHaveCount(12);

    await history.getByRole('link', { name: /Meeting number 3 / }).click();

    await expect(page.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true');
    const notesPanel = page.getByRole('tabpanel', { name: 'Notes' });
    await expect(notesPanel.getByText('Meeting number 3 covered planning')).toBeVisible();
    await expect(
      notesPanel.getByRole('listitem').filter({ hasText: 'Meeting number 3' }),
    ).toBeFocused();
  });

  test('the frequency chart draws twelve weeks and shows a tooltip on hover', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [ALICE]);
    await seedNotes(page, [
      { memberIndex: 0, content: 'One', hoursAgo: 1 },
      { memberIndex: 0, content: 'Two', hoursAgo: 2 },
      { memberIndex: 0, content: 'Three', hoursAgo: 10 * HOURS_PER_DAY },
    ]);
    await openProfile(page);
    await page.getByRole('tab', { name: 'Meetings' }).click();

    const chart = page.getByRole('img', { name: 'Meeting frequency: last 12 weeks' });
    await expect(chart).toBeVisible();
    const bars = page.getByTestId('frequency-bar');
    await expect(bars).toHaveCount(12);
    await expect(
      page.getByRole('table', { name: 'Meetings per week, last 12 weeks' }),
    ).toBeAttached();

    await page.locator('[data-testid="frequency-bar"]:not([data-count="0"])').first().hover();

    await expect(page.getByRole('tooltip')).toHaveText(/^Week of \w{3} \d{1,2}: \d meetings?$/);
    await expectNoViolations(page);
  });
});
