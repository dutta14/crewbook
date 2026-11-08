import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedGrowth, seedId, seedMembers } from './fixtures/seedMembers';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const openGrowthTab = async (page: Page, memberIndex = 0) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('tab', { name: 'Growth' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Growth' });
  await expect(panel.getByRole('heading', { level: 2, name: 'Growth', exact: true })).toBeVisible();
  return panel;
};

const entryDates = (panel: ReturnType<Page['getByRole']>) =>
  panel.getByRole('list', { name: 'Growth timeline' }).locator('time');

test.describe('growth tracking', () => {
  test.beforeEach(async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
  });

  test('a first entry can be added from the empty state and sets the current level', async ({
    unlockedApp: page,
  }) => {
    const panel = await openGrowthTab(page);
    await expect(panel.getByText('Current level / role')).toBeVisible();
    await expect(panel).toContainText('L6 · Staff Engineer');
    await expect(panel.getByRole('heading', { name: 'No growth entries yet' })).toBeVisible();
    await expectNoViolations(page);

    await panel.getByRole('button', { name: 'Add first entry' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add growth entry' });
    await expect(dialog.getByLabel('Date')).toBeFocused();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByText('Enter the date of this change')).toBeVisible();

    await dialog.getByLabel('Date').fill('2025-03-03');
    await dialog.getByLabel('Change type').selectOption({ label: 'Promotion' });
    await dialog.getByLabel('From').fill('L6');
    await dialog.getByLabel('To').fill('L7');
    await dialog.getByLabel('Notes').fill('Led the platform rewrite');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(entryDates(panel)).toHaveText(['Mar 3, 2025']);
    await expect(panel).toContainText('L6 → L7');
    await expect(panel).toContainText('Led the platform rewrite');
    await expect(panel.locator('.growth__current')).toContainText('L7');
    await expectNoViolations(page);

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    const reloaded = await openGrowthTab(page);
    await expect(entryDates(reloaded)).toHaveText(['Mar 3, 2025']);
  });

  test('entries are listed newest first and the current level follows the latest one', async ({
    unlockedApp: page,
  }) => {
    await seedGrowth(page, [
      { memberIndex: 0, date: '2022-01-10', changeType: 'promotion', from: 'L4', to: 'L5' },
      { memberIndex: 0, date: '2024-06-01', changeType: 'promotion', from: 'L5', to: 'L6' },
      { memberIndex: 0, date: '2023-02-01', changeType: 'team_transfer', to: 'Platform' },
      { memberIndex: 1, date: '2025-01-01', changeType: 'promotion', from: 'L3', to: 'L9' },
    ]);

    const panel = await openGrowthTab(page);

    await expect(entryDates(panel)).toHaveText(['Jun 1, 2024', 'Feb 1, 2023', 'Jan 10, 2022']);
    await expect(panel.locator('.growth__current')).toContainText('L6');
    await expect(panel).not.toContainText('L9');
    await expectNoViolations(page);
  });

  test('an entry can be edited', async ({ unlockedApp: page }) => {
    await seedGrowth(page, [
      { memberIndex: 0, date: '2024-06-01', changeType: 'promotion', from: 'L5', to: 'L6' },
    ]);
    const panel = await openGrowthTab(page);

    await panel.getByRole('button', { name: /^Edit promotion entry from June 1, 2024/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit growth entry' });
    await expect(dialog.getByLabel('To')).toHaveValue('L6');
    await dialog.getByLabel('Change type').selectOption({ label: 'Role change' });
    await dialog.getByLabel('To').fill('Principal Engineer');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(panel).toContainText('L5 → Principal Engineer');
    await expect(panel.locator('.growth__current')).toContainText('Principal Engineer');
  });

  test('deleting an entry asks first and can be cancelled', async ({ unlockedApp: page }) => {
    await seedGrowth(page, [
      { memberIndex: 0, date: '2024-06-01', changeType: 'promotion', from: 'L5', to: 'L6' },
    ]);
    const panel = await openGrowthTab(page);
    await panel.getByRole('button', { name: /^Edit promotion entry from/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit growth entry' });

    await dialog.getByRole('button', { name: 'Delete' }).click();
    const confirm = page.getByRole('alertdialog');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toHaveCount(0);
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(panel.getByRole('heading', { name: 'No growth entries yet' })).toBeVisible();
    await expect(
      panel.getByRole('heading', { level: 2, name: 'Growth', exact: true }),
    ).toBeFocused();
  });

  test('the history can be copied as plain text', async ({ unlockedApp: page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await seedGrowth(page, [
      { memberIndex: 0, date: '2022-01-10', changeType: 'promotion', from: 'L4', to: 'L5' },
      { memberIndex: 0, date: '2024-06-01', changeType: 'promotion', from: 'L5', to: 'L6' },
    ]);
    const panel = await openGrowthTab(page);

    await panel.getByRole('button', { name: 'Export growth history as text' }).click();

    await expect(page.getByRole('status').getByText('Copied to clipboard')).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('Alice Park');
    expect(copied.indexOf('Jan 10, 2022')).toBeLessThan(copied.indexOf('Jun 1, 2024'));
    expect(copied).toContain('L5 -> L6');
  });

  test('the Growth tab is reachable with the keyboard', async ({ unlockedApp: page }) => {
    await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(0));
    await page.getByRole('tab', { name: 'Goals' }).click();
    await page.keyboard.press('ArrowRight');

    await expect(page.getByRole('tab', { name: 'Growth' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('tab', { name: 'Growth' })).toBeFocused();
  });
});
