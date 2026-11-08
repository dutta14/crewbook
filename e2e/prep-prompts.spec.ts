import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import {
  SEED_TEAM,
  seedActionItems,
  seedId,
  seedMembers,
  seedNotes,
  type SeedMember,
} from './fixtures/seedMembers';

const WEEKLY = {
  cadence: 'weekly',
  dayOfWeek: 'monday',
  time: '10:00',
  nextDate: '2099-01-05',
} as const;

const HOURS_PER_DAY = 24;
const LONG_NOTE = `We covered the migration plan and the on-call rotation. ${'Then a long tail of detail about staffing. '.repeat(4)}`;

const ALICE: SeedMember = { ...SEED_TEAM[0], schedule: WEEKLY };

const openProfile = async (page: Page, memberIndex = 0) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

const prepCard = (page: Page) => page.getByRole('region', { name: 'PREP', exact: true });

test.describe('1:1 prep prompts', () => {
  test('prep prompts show carry-forward action items from last 1:1', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [
      {
        ...ALICE,
        history: [
          {
            id: 'change-1',
            date: new Date(Date.now() - 2 * HOURS_PER_DAY * 3_600_000).toISOString(),
            field: 'status',
            from: 'active',
            to: 'on_leave',
          },
        ],
      },
    ]);
    await seedNotes(page, [{ memberIndex: 0, content: LONG_NOTE, hoursAgo: 5 * HOURS_PER_DAY }]);
    await seedActionItems(page, [
      { memberIndex: 0, title: 'Send the migration plan' },
      { memberIndex: 0, title: 'Book the staffing review' },
    ]);

    await openProfile(page);

    const card = prepCard(page);
    await expect(card.getByRole('heading', { name: 'PREP' })).toBeVisible();
    await expect(
      card.getByRole('listitem').filter({ hasText: 'Send the migration plan' }),
    ).toBeVisible();
    await expect(
      card.getByRole('listitem').filter({ hasText: 'Book the staffing review' }),
    ).toBeVisible();
    await expect(card.getByText('Last time you discussed:')).toBeVisible();
    const summary = card.locator('.prep-card__summary');
    await expect(summary).toHaveText(
      /^We covered the migration plan and the on-call rotation\. Then a long tail.*…$/,
    );
    expect((await summary.textContent())!.length).toBeLessThanOrEqual(100);
    await expect(card.getByText('5 days')).toBeVisible();
    await expect(card.getByText('On leave')).toBeVisible();
    await expect(card.getByText('2 days ago')).toBeVisible();
    await expect(card.getByText('No reminders')).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(violations).toEqual([]);
  });

  test('prep prompts show days-since-last-1:1 with warning when overdue', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [ALICE]);
    await seedNotes(page, [
      { memberIndex: 0, content: 'Quick sync', hoursAgo: 21 * HOURS_PER_DAY },
    ]);

    await openProfile(page);

    const count = prepCard(page).getByText('21 days', { exact: true });
    await expect(count).toBeVisible();
    await expect(count.locator('..')).toHaveCSS('color', 'rgb(220, 38, 38)');
    await expect(prepCard(page).getByRole('status')).toHaveText(
      'Warning: 21 days since last 1:1, exceeds usual cadence',
    );
  });

  test('prep prompts do not warn when the last 1:1 is within the usual cadence', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [ALICE]);
    await seedNotes(page, [{ memberIndex: 0, content: 'Quick sync', hoursAgo: 6 * HOURS_PER_DAY }]);

    await openProfile(page);

    await expect(prepCard(page).getByText('6 days', { exact: true })).toBeVisible();
    await expect(prepCard(page).getByRole('status')).toHaveCount(0);
  });

  test('prep prompts appear in live mode context sidebar', async ({ unlockedApp: page }) => {
    await seedMembers(page, [ALICE]);
    await seedNotes(page, [{ memberIndex: 0, content: 'Quick sync', hoursAgo: 4 * HOURS_PER_DAY }]);
    await seedActionItems(page, [
      { memberIndex: 0, title: 'Review the offer letter' },
      { memberIndex: 0, title: 'Share the design doc' },
    ]);
    await openProfile(page);

    await page.getByRole('button', { name: 'Start 1:1' }).click();

    const sidebar = page
      .getByRole('dialog', { name: /^1:1 with / })
      .getByRole('complementary', { name: '1:1 context' });
    const card = sidebar.getByRole('region', { name: 'PREP', exact: true });
    await expect(card).toBeVisible();
    await expect(
      card.getByRole('listitem').filter({ hasText: 'Review the offer letter' }),
    ).toBeVisible();
    await expect(
      card.getByRole('listitem').filter({ hasText: 'Share the design doc' }),
    ).toBeVisible();
    await expect(prepCard(page)).toHaveCount(1);
  });

  test('manager collapses and dismisses prep prompts', async ({ unlockedApp: page }) => {
    await seedMembers(page, [ALICE]);
    await seedNotes(page, [{ memberIndex: 0, content: 'Quick sync', hoursAgo: 4 * HOURS_PER_DAY }]);
    await seedActionItems(page, [{ memberIndex: 0, title: 'Review the offer letter' }]);
    await openProfile(page);
    const content = page.locator('#prep-content');
    await expect(content).toBeVisible();

    await page.getByRole('button', { name: 'Collapse prep' }).click();
    await expect(page.getByRole('button', { name: 'Expand prep' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(content).toBeHidden();

    await page.getByRole('button', { name: 'Expand prep' }).click();
    await expect(content).toBeVisible();
    await expect(content.getByText('Review the offer letter')).toBeVisible();

    await page.getByRole('button', { name: 'Dismiss prep prompts' }).click();
    await expect(prepCard(page)).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeFocused();

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await expect(prepCard(page)).toBeVisible();
  });

  test('prep prompts do not render when there are no previous 1:1s', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [ALICE]);
    await seedActionItems(page, [{ memberIndex: 0, title: 'Review the offer letter' }]);

    await openProfile(page);

    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(prepCard(page)).toHaveCount(0);
  });
});
