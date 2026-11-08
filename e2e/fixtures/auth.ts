import { test as base, type Page } from '@playwright/test';

export const TEST_PASSPHRASE = 'correct horse battery staple';

/**
 * Seam for issue #2. The lock screen and encryption do not exist yet, so the app is
 * always "unlocked". Once they land, this fixture should create a passphrase and
 * unlock through the real UI, then resolve with the page.
 */
export const test = base.extend<{ unlockedApp: Page }>({
  unlockedApp: async ({ page }, use) => {
    await page.goto('/');
    await use(page);
  },
});

export { expect } from '@playwright/test';
