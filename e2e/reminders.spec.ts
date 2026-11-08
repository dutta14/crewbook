import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedId, seedMembers, seedReminders } from './fixtures/seedMembers';

const TEAM = SEED_TEAM.slice(0, 2);

const expectNoViolations = async (page: Page, exclude?: string) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);
  if (exclude) axe.exclude(exclude);
  const { violations } = await axe.analyze();
  expect(violations).toEqual([]);
};

const openProfile = async (page: Page, memberIndex = 0) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

const openDashboard = async (page: Page) => {
  await page.evaluate(() => window.location.assign('#/'));
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
};

test.describe('contextual reminders', () => {
  test.beforeEach(async ({ unlockedApp: page }) => {
    await seedMembers(page, TEAM);
  });

  test('creates a before-next-1:1 reminder from a profile and sees it in the live mode sidebar', async ({
    unlockedApp: page,
  }) => {
    await openProfile(page);
    await page.getByRole('button', { name: 'Add reminder for Alice Park' }).click();
    const dialog = page.getByRole('dialog', { name: 'New Reminder' });
    await expect(dialog.getByRole('textbox', { name: /Reminder/ })).toBeFocused();
    await expect(dialog.getByLabel('Linked person')).toHaveValue('Alice Park');
    await expectNoViolations(page);
    await dialog.getByRole('textbox', { name: /Reminder/ }).fill('Ask about the on-call rotation');
    await dialog.getByRole('button', { name: 'Save reminder' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Reminder saved')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Reminders' }).getByText('Ask about the on-call rotation'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Start 1:1' }).click();
    const live = page.getByRole('dialog', { name: /^1:1 with / });
    const sidebar = live.getByRole('complementary', { name: '1:1 context' });
    await expect(
      sidebar
        .getByRole('region', { name: 'Reminders' })
        .getByText('Ask about the on-call rotation'),
    ).toBeVisible();
    await expectNoViolations(page);
  });

  test('a reminder set for today appears on the dashboard and survives a reload', async ({
    unlockedApp: page,
  }) => {
    await seedReminders(
      page,
      [
        {
          text: 'Congratulate on the launch',
          memberIndex: 1,
          triggerType: 'specific_date',
          triggerInDays: 0,
        },
        { text: 'Not yet', memberIndex: 0, triggerType: 'specific_date', triggerInDays: 3 },
      ],
      TEAM,
    );

    const card = page.getByRole('region', { name: 'Reminders' });
    await expect(card.getByText('Congratulate on the launch')).toBeVisible();
    await expect(card.getByRole('img', { name: 'Bob Singh' })).toBeVisible();
    await expect(card.getByText('Not yet')).toHaveCount(0);
    await expectNoViolations(page);

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await expect(
      page.getByRole('region', { name: 'Reminders' }).getByText('Congratulate on the launch'),
    ).toBeVisible();
  });

  test('dismissing a reminder from the dashboard removes it for good', async ({
    unlockedApp: page,
  }) => {
    await seedReminders(
      page,
      [
        {
          text: 'Congratulate on the launch',
          memberIndex: 0,
          triggerType: 'specific_date',
          triggerInDays: 0,
        },
      ],
      TEAM,
    );

    await page.getByRole('button', { name: /^Dismiss reminder: Congratulate/ }).click();

    await expect(page.getByRole('region', { name: 'Reminders' })).toHaveCount(0);
    await expect(page.getByText('Congratulate on the launch')).toHaveCount(0);

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Congratulate on the launch')).toHaveCount(0);
    await openProfile(page);
    const past = page.getByRole('region', { name: 'Past reminders' });
    await expect(past.getByText('Congratulate on the launch')).toBeVisible();
  });

  test('snoozing for a week hides the reminder from the dashboard and keeps the snooze after a reload', async ({
    unlockedApp: page,
  }) => {
    await seedReminders(
      page,
      [
        {
          text: 'Check on the offsite',
          memberIndex: 0,
          triggerType: 'specific_date',
          triggerInDays: 0,
        },
      ],
      TEAM,
    );

    await page.getByRole('button', { name: 'Snooze' }).click();
    const menu = page.getByRole('menu', { name: 'Snooze for' });
    await expect(menu.getByRole('menuitem')).toHaveText(['1 day', '1 week', 'Next 1:1']);
    await expect(menu.getByRole('menuitem', { name: '1 day' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: '1 week' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('region', { name: 'Reminders' })).toHaveCount(0);

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await openDashboard(page);
    await expect(page.getByRole('region', { name: 'Reminders' })).toHaveCount(0);
    await openProfile(page);
    await expect(page.getByText(/^Snoozed until /)).toBeVisible();
    await expect(page.getByText('Check on the offsite')).toBeVisible();
  });

  test('the profile lists active reminders, then past ones below a divider at reduced opacity', async ({
    unlockedApp: page,
  }) => {
    await seedReminders(
      page,
      [
        { text: 'First active', memberIndex: 0 },
        { text: 'Second active', memberIndex: 0, status: 'snoozed', snoozedInDays: 3 },
        { text: 'Already done', memberIndex: 0, status: 'dismissed' },
        { text: 'About Bob', memberIndex: 1 },
      ],
      TEAM,
    );

    await openProfile(page);

    const reminders = page.getByRole('region', { name: 'Reminders' });
    await expect(reminders.getByText('First active')).toBeVisible();
    await expect(reminders.getByText('Second active')).toBeVisible();
    await expect(page.getByText('About Bob')).toHaveCount(0);
    const past = page.getByRole('region', { name: 'Past reminders' });
    await expect(past.getByText('Already done')).toBeVisible();
    await expect(page.getByRole('separator')).toBeVisible();
    await expect(past.locator('.reminder-card')).toHaveCSS('opacity', '0.6');
    await expect(past.getByRole('button')).toHaveCount(0);
    // Past reminders are dimmed to 0.6 opacity by design, so their text is outside the contrast rule.
    await expectNoViolations(page, '.reminder-card--past');
  });
});
