import AxeBuilder from '@axe-core/playwright';
import { expect, setUpPassphrase, TEST_PASSPHRASE, test, unlock } from './fixtures/auth';

test.describe('first launch', () => {
  test('sets a passphrase and lands on the Dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Welcome to Crewbook' }),
    ).toBeVisible();
    await expect(page.getByLabel('Passphrase', { exact: true })).toBeFocused();

    await page.getByLabel('Passphrase', { exact: true }).fill(TEST_PASSPHRASE);
    await page.getByLabel('Confirm passphrase').fill(TEST_PASSPHRASE);
    await page.getByRole('button', { name: 'Get Started' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  });

  test('stores only ciphertext and never the passphrase', async ({ page }) => {
    await setUpPassphrase(page);

    const stored = await page.evaluate(() =>
      Object.fromEntries(
        Object.keys(window.localStorage)
          .filter((key) => key.startsWith('crewbook_'))
          .map((key) => [key, window.localStorage.getItem(key) ?? '']),
      ),
    );

    expect(Object.keys(stored)).toEqual(
      expect.arrayContaining([
        'crewbook_data',
        'crewbook_private',
        'crewbook_salt',
        'crewbook_check',
      ]),
    );
    expect(JSON.stringify(stored)).not.toContain(TEST_PASSPHRASE);
    expect(JSON.parse(stored.crewbook_data)).toMatchObject({ v: 1, iterations: 310000 });
  });

  test('rejects a confirmation that does not match and stays on setup', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Passphrase', { exact: true }).fill('first-passphrase');
    await page.getByLabel('Confirm passphrase').fill('second-passphrase');
    await page.getByRole('button', { name: 'Get Started' }).click();

    await expect(page.getByRole('alert')).toHaveText("Passphrases don't match.");
    await expect(page.getByLabel('Confirm passphrase')).toBeFocused();
    await expect(
      page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toHaveCount(0);
  });

  test('submits with the Enter key', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Passphrase', { exact: true }).fill(TEST_PASSPHRASE);

    await page.getByLabel('Confirm passphrase').fill(TEST_PASSPHRASE);
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toBeVisible();
  });

  test('has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

    expect(violations).toEqual([]);
  });
});

test.describe('returning user', () => {
  test.beforeEach(async ({ page }) => {
    await setUpPassphrase(page);
    await page.reload();
  });

  test('is asked to unlock after a reload', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Crewbook' })).toBeVisible();
    await expect(page.getByLabel('Confirm passphrase')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toHaveCount(0);
  });

  test('unlocks with the right passphrase', async ({ page }) => {
    await unlock(page);

    await expect(
      page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toBeVisible();
  });

  test('shows an alert and stays locked after a wrong passphrase', async ({ page }) => {
    await unlock(page, 'not the passphrase');

    await expect(page.getByRole('alert')).toHaveText('Wrong passphrase. Try again.');
    await expect(page.getByLabel('Passphrase', { exact: true })).toBeFocused();
    await expect(page.getByLabel('Passphrase', { exact: true })).toHaveValue('');
    await expect(
      page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toHaveCount(0);
  });

  test('accepts the right passphrase after a wrong attempt', async ({ page }) => {
    await unlock(page, 'not the passphrase');
    await expect(page.getByRole('alert')).toBeVisible();

    await unlock(page);

    await expect(
      page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toBeVisible();
  });

  test('has no WCAG A/AA violations in the error state', async ({ page }) => {
    await unlock(page, 'not the passphrase');
    await expect(page.getByRole('alert')).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

    expect(violations).toEqual([]);
  });
});

test.describe('unreadable data', () => {
  test('lets the user erase everything and start over', async ({ page }) => {
    await setUpPassphrase(page);
    await page.evaluate(() => window.localStorage.removeItem('crewbook_salt'));
    await page.reload();

    await page.getByRole('button', { name: 'Erase and start over' }).click();
    await page.getByRole('button', { name: 'Erase everything' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Welcome to Crewbook' }),
    ).toBeVisible();
  });
});
