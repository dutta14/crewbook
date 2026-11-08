import AxeBuilder from '@axe-core/playwright';
import { expect, setUpPassphrase, test, unlock } from './fixtures/auth';

const scan = async (page: import('@playwright/test').Page) => {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

test.describe('app shell', () => {
  test('loads with the Crewbook title and the Dashboard heading', async ({ unlockedApp: page }) => {
    await expect(page).toHaveTitle('Crewbook');
    await expect(
      page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toBeVisible();
  });

  test('shows the main navigation and navigates between pages', async ({ unlockedApp: page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' });

    await expect(nav.getByRole('link')).toHaveCount(7);
    await nav.getByRole('link', { name: 'Team' }).click();

    await expect(page).toHaveURL(/#\/roster$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Team' })).toHaveAttribute('aria-current', 'page');
  });

  test('redirects unknown routes to the dashboard', async ({ unlockedApp: page }) => {
    await page.goto('/#/does-not-exist');

    await expect(
      page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ }),
    ).toBeVisible();
  });

  test('skip link moves focus to the main content', async ({ unlockedApp: page }) => {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('dark mode toggle applies the dark theme and persists across reloads', async ({
    unlockedApp: page,
  }) => {
    const toggle = page.getByRole('button', { name: 'Toggle dark mode' });

    await toggle.click();
    await expect(page.locator('body')).toHaveClass(/dark/);

    await page.reload();
    await unlock(page);
    await expect(page.locator('body')).toHaveClass(/dark/);
  });

  test('renders without uncaught runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await setUpPassphrase(page);
    await expect(page.getByRole('main')).toBeVisible();

    expect(errors).toEqual([]);
  });
});

test.describe('mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('opens and closes the sidebar from the hamburger button', async ({ unlockedApp: page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' });

    await expect(nav).toBeHidden();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(nav).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
  });
});

test.describe('accessibility', () => {
  for (const [name, path] of [
    ['dashboard', '#/'],
    ['roster', '#/roster'],
    ['calendar', '#/calendar'],
    ['settings', '#/settings'],
  ] as const) {
    test(`${name} has no WCAG A/AA violations in light mode`, async ({ unlockedApp: page }) => {
      await page.evaluate((hash) => window.location.assign(hash), path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      await scan(page);
    });

    test(`${name} has no WCAG A/AA violations in dark mode`, async ({ unlockedApp: page }) => {
      await page.evaluate((hash) => window.location.assign(hash), path);
      await page.getByRole('button', { name: 'Toggle dark mode' }).click();
      await expect(page.locator('body')).toHaveClass(/dark/);

      await scan(page);
    });
  }

  test('mobile layout with the sidebar open has no violations', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await setUpPassphrase(page);
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();

    await scan(page);
  });
});
