import { test as base, expect, type Page } from '@playwright/test';

export const TEST_PASSPHRASE = 'correct horse battery staple';

export async function setUpPassphrase(page: Page, passphrase = TEST_PASSPHRASE) {
  await page.goto('/');
  await page.getByLabel('Passphrase', { exact: true }).fill(passphrase);
  await page.getByLabel('Confirm passphrase').fill(passphrase);
  await page.getByRole('button', { name: 'Get Started' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
  ).toBeVisible();
}

export async function unlock(page: Page, passphrase = TEST_PASSPHRASE) {
  await page.getByLabel('Passphrase', { exact: true }).fill(passphrase);
  await page.getByRole('button', { name: 'Unlock' }).click();
}

/** A page that has completed first-launch setup through the real lock screen. */
export const test = base.extend<{ unlockedApp: Page }>({
  unlockedApp: async ({ page }, use) => {
    await setUpPassphrase(page);
    await use(page);
  },
});

export { expect };
