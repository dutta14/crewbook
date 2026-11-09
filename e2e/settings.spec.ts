import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedMembers, seedMoods } from './fixtures/seedMembers';

const NEW_PASSPHRASE = 'a different passphrase entirely';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const openSettings = async (page: Page) => {
  await page.evaluate(() => window.location.assign('#/settings'));
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
};

const reloadAndUnlock = async (page: Page, passphrase = TEST_PASSPHRASE) => {
  await page.reload();
  await unlock(page, passphrase);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
};

const rosterRows = async (page: Page) => {
  await page.evaluate(() => window.location.assign('#/roster'));
  await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();
  return page.getByTestId('member-row');
};

const startClear = async (page: Page) => {
  await page.getByRole('button', { name: 'Clear All Data' }).click();
  await page.getByRole('alertdialog', { name: 'Clear all data?' }).waitFor();
};

test.describe('settings', () => {
  test('preferences are saved and still there after locking and unlocking', async ({
    unlockedApp: page,
  }) => {
    await openSettings(page);
    await page.getByRole('combobox', { name: 'Default 1:1 cadence' }).selectOption('monthly');
    await page.getByRole('combobox', { name: 'Date format' }).selectOption('DD/MM/YYYY');
    await page.getByRole('combobox', { name: 'First day of week' }).selectOption('sunday');
    await page.getByRole('combobox', { name: 'Private data auto-lock' }).selectOption('15');
    await page.getByRole('switch', { name: 'Live mode keyboard shortcuts' }).uncheck();
    await page.getByRole('switch', { name: 'Dark mode' }).check();
    await expect(page.locator('body')).toHaveClass(/dark/);
    await expectNoViolations(page);

    await reloadAndUnlock(page);
    await openSettings(page);

    await expect(page.getByRole('combobox', { name: 'Default 1:1 cadence' })).toHaveValue(
      'monthly',
    );
    await expect(page.getByRole('combobox', { name: 'Date format' })).toHaveValue('DD/MM/YYYY');
    await expect(page.getByRole('combobox', { name: 'First day of week' })).toHaveValue('sunday');
    await expect(page.getByRole('combobox', { name: 'Private data auto-lock' })).toHaveValue('15');
    await expect(
      page.getByRole('switch', { name: 'Live mode keyboard shortcuts' }),
    ).not.toBeChecked();
    await expect(page.getByRole('switch', { name: 'Dark mode' })).toBeChecked();
    await expect(page.locator('body')).toHaveClass(/dark/);
  });

  test('turning mood tracking off offers to delete saved entries', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await seedMoods(page, [
      { memberIndex: 0, score: 4, daysAgo: 2 },
      { memberIndex: 0, score: 3, daysAgo: 1 },
    ]);
    await openSettings(page);
    const mood = page.getByRole('switch', { name: 'Track energy/mood after 1:1s' });
    await mood.check();

    await mood.uncheck();
    const dialog = page.getByRole('alertdialog', { name: 'Delete saved mood entries?' });
    await expect(dialog.getByRole('button', { name: 'Keep entries' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Keep entries' }).click();
    await expect(dialog).toHaveCount(0);
    await mood.check();
    await mood.uncheck();
    await page.getByRole('button', { name: 'Delete 2 entries' }).click();

    await expect(page.getByText('Mood entries deleted')).toBeVisible();
    await mood.check();
    await mood.uncheck();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('changing the passphrase validates, re-encrypts and replaces the old one', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await openSettings(page);
    const current = page.getByLabel(/^Current passphrase/);
    const next = page.getByLabel(/^New passphrase/);
    const confirm = page.getByLabel(/^Confirm new passphrase/);
    const update = page.getByRole('button', { name: 'Update', exact: true });

    await current.fill(TEST_PASSPHRASE);
    await next.fill('short');
    await confirm.fill('short');
    await update.click();
    await expect(page.getByText(/at least 8 characters/)).toBeVisible();

    await next.fill(NEW_PASSPHRASE);
    await confirm.fill('does not match at all');
    await update.click();
    await expect(page.getByText('Passphrases do not match')).toBeVisible();

    await current.fill('not the current passphrase');
    await confirm.fill(NEW_PASSPHRASE);
    await update.click();
    await expect(page.getByText('Current passphrase is incorrect')).toBeVisible();

    await current.fill(TEST_PASSPHRASE);
    await update.click();
    await expect(page.getByText('Passphrase updated')).toBeVisible();
    await expect(current).toHaveValue('');
    await expectNoViolations(page);

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await expect(page.getByRole('alert')).toBeVisible();
    await unlock(page, NEW_PASSPHRASE);
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(await rosterRows(page)).toHaveCount(2);
  });

  test('clearing all data needs a typed DELETE and leaves an empty app', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await openSettings(page);
    await startClear(page);
    await expectNoViolations(page);

    await page.getByRole('button', { name: 'Continue' }).click();
    const input = page.getByLabel(/^Type DELETE/);
    const final = page.getByRole('button', { name: 'Delete Everything' });
    await expect(final).toHaveAttribute('aria-disabled', 'true');
    await input.fill('delete');
    await final.click({ force: true });
    await expect(final).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('alertdialog', { name: 'Delete everything' })).toBeVisible();

    await input.fill('DELETE');
    await expect(final).toHaveAttribute('aria-disabled', 'false', { timeout: 10_000 });
    await final.click();

    await expect(page.getByText(/App data cleared/)).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(await rosterRows(page)).toHaveCount(0);

    await reloadAndUnlock(page);
    await expect(await rosterRows(page)).toHaveCount(0);
  });

  test('cancelling at any step of clearing keeps all data', async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await openSettings(page);

    await startClear(page);
    await page
      .getByRole('alertdialog', { name: 'Clear all data?' })
      .getByRole('button', { name: 'Cancel' })
      .click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Clear All Data' })).toBeFocused();

    await startClear(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel(/^Type DELETE/).fill('DELETE');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    await expect(await rosterRows(page)).toHaveCount(2);
  });
});
