import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedMembers } from './fixtures/seedMembers';

const rows = (page: Page) => page.getByTestId('member-row');
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Add Team Member' });

const goToRoster = async (page: Page) => {
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Team' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();
};

const openAddDialog = async (page: Page) => {
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole('heading', { name: 'Add Team Member' })).toBeVisible();
};

test.describe('add member', () => {
  test.beforeEach(async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM);
    await goToRoster(page);
  });

  test('manager adds a new team member and sees them in the roster', async ({ page }) => {
    await openAddDialog(page);
    const form = dialog(page);

    await form.getByLabel('Name').fill('Priya Sharma');
    await form.getByLabel('Role').fill('Software Engineer');
    await form.getByLabel('Level').fill('L5');
    await form.getByLabel('Email').fill('priya@example.com');
    await form.getByLabel('Manager').selectOption({ label: 'Alice Park' });
    await form.getByRole('button', { name: 'Add Member', exact: true }).click();

    await expect(dialog(page)).toBeHidden();
    await expect(page.getByText('Priya Sharma added to your team')).toBeVisible();
    const priya = rows(page).filter({ hasText: 'Priya Sharma' });
    await expect(priya).toHaveCount(1);
    await expect(priya).toContainText('Software Engineer');
    await expect(priya).toContainText('L5');
    await expect(rows(page)).toHaveCount(5);
    await expect(page.getByText('5 members found')).toBeAttached();
  });

  test('a saved member survives a reload and unlock', async ({ page }) => {
    await openAddDialog(page);
    await dialog(page).getByLabel('Name').fill('Priya Sharma');
    await dialog(page).getByLabel('Role').fill('Software Engineer');
    await dialog(page).getByRole('button', { name: 'Add Member', exact: true }).click();
    await expect(rows(page).filter({ hasText: 'Priya Sharma' })).toHaveCount(1);

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);

    await expect(rows(page).filter({ hasText: 'Priya Sharma' })).toHaveCount(1);
    await expect(rows(page)).toHaveCount(5);
  });

  test('form validation prevents submitting without required name', async ({ page }) => {
    await openAddDialog(page);
    const form = dialog(page);

    await form.getByLabel('Role').fill('Software Engineer');
    await form.getByLabel('Email').fill('someone@example.com');
    await form.getByRole('button', { name: 'Add Member', exact: true }).click();

    const name = form.getByLabel('Name');
    await expect(form.getByText('Enter a name.')).toBeVisible();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toBeFocused();
    await expect(dialog(page)).toBeVisible();
    await expect(rows(page)).toHaveCount(4);
  });

  test('an invalid email and a start date far in the past are both reported', async ({ page }) => {
    await openAddDialog(page);
    const form = dialog(page);

    await form.getByLabel('Name').fill('Priya Sharma');
    await form.getByLabel('Start date').fill('2001-01-01');
    await form.getByLabel('Email').fill('not-an-email');
    await form.getByRole('button', { name: 'Add Member', exact: true }).click();

    await expect(form.getByText('Enter an email like name@example.com.')).toBeVisible();
    await expect(form.getByText('Start date can’t be more than a year ago.')).toBeVisible();
    await expect(form.getByLabel('Start date')).toBeFocused();
    await expect(rows(page)).toHaveCount(4);
  });

  test('Escape key closes modal without adding member', async ({ page }) => {
    await openAddDialog(page);

    await dialog(page).getByLabel('Name').fill('Test User');
    await page.keyboard.press('Escape');

    await expect(dialog(page)).toBeHidden();
    await expect(rows(page).filter({ hasText: 'Test User' })).toHaveCount(0);
    await expect(rows(page)).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Add member', exact: true })).toBeFocused();

    await openAddDialog(page);
    await expect(dialog(page).getByLabel('Name')).toHaveValue('');
  });

  test('Enter submits from the keyboard and Tab stays inside the dialog', async ({ page }) => {
    await openAddDialog(page);
    await expect(dialog(page).getByLabel('Name')).toBeFocused();

    // The date input has several internal tab stops, so 15 presses covers a full loop and more.
    for (let step = 0; step < 15; step += 1) {
      await page.keyboard.press('Tab');
      const inDialog = await page.evaluate(
        () => document.activeElement?.closest('[role="dialog"]') !== null,
      );
      expect(inDialog, `Tab press ${step + 1} left the dialog`).toBe(true);
    }

    await dialog(page).getByLabel('Name').fill('Keyboard Kim');
    await page.keyboard.press('Enter');

    await expect(dialog(page)).toBeHidden();
    await expect(rows(page).filter({ hasText: 'Keyboard Kim' })).toHaveCount(1);
  });

  test('added member is navigable from roster to profile', async ({ page }) => {
    await openAddDialog(page);
    await dialog(page).getByLabel('Name').fill('Ravi Kumar');
    await dialog(page).getByLabel('Role').fill('Designer');
    await dialog(page).getByRole('button', { name: 'Add Member', exact: true }).click();
    const ravi = rows(page).filter({ hasText: 'Ravi Kumar' });
    await expect(ravi).toHaveCount(1);

    await ravi.click();

    // The profile page is still a placeholder; its content arrives with a later issue.
    await expect(page).toHaveURL(/#\/person\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
  });

  for (const mode of ['light', 'dark'] as const) {
    test(`the open dialog has no WCAG A/AA violations in ${mode} mode`, async ({ page }) => {
      if (mode === 'dark') {
        await page.getByRole('button', { name: 'Toggle dark mode' }).click();
        await expect(page.locator('body')).toHaveClass(/dark/);
      }
      await openAddDialog(page);
      await dialog(page).getByRole('button', { name: 'Add Member', exact: true }).click();
      await expect(dialog(page).getByText('Enter a name.')).toBeVisible();

      const { violations } = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      expect(violations).toEqual([]);
    });
  }
});

test.describe('add member on a narrow screen', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('opens as a full-screen sheet and adds a member', async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM);
    await page.evaluate(() => window.location.assign('#/roster'));
    await openAddDialog(page);

    await expect.poll(async () => (await dialog(page).boundingBox())?.width).toBeCloseTo(390, 0);
    await expect.poll(async () => (await dialog(page).boundingBox())?.height).toBeCloseTo(800, 0);
    const close = dialog(page).getByRole('button', { name: 'Close dialog' });
    const box = await close.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);

    await dialog(page).getByLabel('Name').fill('Mobile Mia');
    await dialog(page).getByRole('button', { name: 'Add Member', exact: true }).click();

    await expect(dialog(page)).toBeHidden();
    await expect(rows(page).filter({ hasText: 'Mobile Mia' })).toHaveCount(1);
  });
});

test.describe('add the first member from the empty state', () => {
  test('the empty state button opens the form and the first member appears', async ({
    unlockedApp: page,
  }) => {
    await goToRoster(page);

    await page.getByRole('button', { name: 'Add your first team member' }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(
      dialog(page).getByRole('combobox', { name: 'Manager' }).getByRole('option'),
    ).toHaveText(['None']);
    await dialog(page).getByLabel('Name').fill('First Person');
    await dialog(page).getByRole('button', { name: 'Add Member', exact: true }).click();

    await expect(page.getByText('First Person added to your team')).toBeVisible();
    await expect(rows(page).filter({ hasText: 'First Person' })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'No team members yet' })).toHaveCount(0);
  });
});
