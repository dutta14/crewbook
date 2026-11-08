import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';
import { seedId, seedMembers, type SeedMember } from './fixtures/seedMembers';

const TEAM: SeedMember[] = [
  {
    name: 'Alex Chen',
    role: 'Software Engineer',
    level: 'L4',
    status: 'active',
    startDate: '2023-03-13',
    email: 'alex.chen@example.com',
    managerIndex: 1,
    customFields: { Team: 'Payments' },
  },
  {
    name: 'Priya Nair',
    role: 'Engineering Manager',
    level: 'L6',
    status: 'on_leave',
    startDate: '2020-01-06',
  },
];

const profileUrl = (index: number) => new RegExp(`#/person/${seedId(index)}$`);

const openProfile = async (page: Page, index = 0) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(index));
};

const header = (page: Page) => page.locator('header.profile-header');

test.describe('member profile', () => {
  test.beforeEach(async ({ unlockedApp: page }) => {
    await seedMembers(page, TEAM);
  });

  test('manager navigates from roster to member profile and back', async ({ page }) => {
    await page.evaluate(() => window.location.assign('#/roster'));
    await page.getByTestId('member-row').filter({ hasText: 'Alex Chen' }).click();

    await expect(page).toHaveURL(profileUrl(0));
    await expect(page.getByRole('heading', { level: 1, name: 'Alex Chen' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Alex Chen' })).toBeFocused();
    await expect(header(page)).toContainText('Software Engineer · L4');
    await expect(header(page).getByText('Active', { exact: true })).toBeVisible();
    await expect(header(page).getByRole('link', { name: 'alex.chen@example.com' })).toHaveAttribute(
      'href',
      'mailto:alex.chen@example.com',
    );

    await page.getByRole('main').getByRole('link', { name: 'Team', exact: true }).click();

    await expect(page).toHaveURL(/#\/roster$/);
  });

  test('manager edits a member profile and sees updated data', async ({ page }) => {
    await openProfile(page);
    const editButton = page.getByRole('button', { name: "Edit Alex Chen's profile" });
    await editButton.click();

    const dialog = page.getByRole('dialog', { name: 'Edit Team Member' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Name')).toHaveValue('Alex Chen');
    await expect(dialog.getByLabel('Role')).toHaveValue('Software Engineer');
    await expect(dialog.getByLabel('Email')).toHaveValue('alex.chen@example.com');
    await expect(dialog.getByLabel('Manager')).toHaveValue(seedId(1));

    await dialog.getByLabel('Role').fill('Staff Engineer');
    await dialog.getByLabel('Status').selectOption('on_leave');
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('Alex Chen updated')).toBeVisible();
    await expect(header(page)).toContainText('Staff Engineer · L4');
    await expect(header(page).getByText('On leave', { exact: true })).toBeVisible();
    await expect(editButton).toBeFocused();

    await page.getByRole('tab', { name: 'Timeline' }).click();
    await expect(page.getByText('Role changed to Staff Engineer')).toBeVisible();
    await expect(page.getByText('Status changed from Active to On Leave')).toBeVisible();
  });

  test('edits survive a reload', async ({ page }) => {
    await openProfile(page);
    await page.getByRole('button', { name: "Edit Alex Chen's profile" }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Team Member' });
    await dialog.getByLabel('Level').fill('L5');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(header(page)).toContainText('Software Engineer · L5');

    await page.reload();
    await page.getByLabel('Passphrase', { exact: true }).fill('correct horse battery staple');
    await page.getByRole('button', { name: 'Unlock' }).click();

    await expect(header(page)).toContainText('Software Engineer · L5');
  });

  test('tab navigation shows different profile sections', async ({ page }) => {
    await openProfile(page);
    const overview = page.getByRole('tab', { name: 'Overview' });
    await expect(overview).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Overview' })).toContainText('Payments');

    await page.getByRole('tab', { name: 'Notes' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Notes' })).toContainText('No notes yet');

    await page.getByRole('tab', { name: 'Timeline' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Timeline' })).toContainText('Added to team');
    await expect(page.getByRole('listitem').filter({ hasText: 'Added to team' })).toHaveCount(1);

    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Timeline' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Goals' })).toHaveAttribute('aria-selected', 'true');
  });

  test('manager link in profile navigates to manager profile', async ({ page }) => {
    await openProfile(page);

    await page
      .getByRole('tabpanel', { name: 'Overview' })
      .getByRole('link', { name: 'Priya Nair' })
      .click();

    await expect(page).toHaveURL(profileUrl(1));
    await expect(page.getByRole('heading', { level: 1, name: 'Priya Nair' })).toBeFocused();
  });

  test('deleting a member asks for confirmation, then returns to the roster', async ({ page }) => {
    await openProfile(page);
    await page.getByRole('button', { name: 'Delete Alex Chen' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Alex Chen?' });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Alex Chen' })).toBeVisible();

    await page.getByRole('button', { name: 'Delete Alex Chen' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page).toHaveURL(/#\/roster$/);
    await expect(page.getByText('Alex Chen removed from your team')).toBeVisible();
    await expect(page.getByTestId('member-row')).toHaveCount(1);
  });

  test('keeps the member name out of the page title and URL', async ({ page }) => {
    await openProfile(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Alex Chen' })).toBeVisible();

    await expect(page).toHaveTitle('Crewbook');
    expect(page.url()).not.toContain('Alex');
  });

  for (const mode of ['light', 'dark'] as const) {
    test(`has no WCAG A/AA violations in ${mode} mode`, async ({ page }) => {
      await openProfile(page);
      if (mode === 'dark') {
        await page.getByRole('button', { name: 'Toggle dark mode' }).click();
        await expect(page.locator('body')).toHaveClass(/dark/);
      }
      await expect(page.getByRole('heading', { level: 1, name: 'Alex Chen' })).toBeVisible();

      for (const tab of ['Overview', 'Timeline']) {
        await page.getByRole('tab', { name: tab }).click();
        // Axe samples colours mid-fade otherwise.
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze();
        expect(violations, `${tab} tab`).toEqual([]);
      }
    });
  }
});

test.describe('member profile on a narrow screen', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('stacks the header and keeps all six tabs reachable', async ({ unlockedApp: page }) => {
    await seedMembers(page, TEAM);
    await openProfile(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Alex Chen' })).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(6);
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(noOverflow).toBe(true);
  });
});

test.describe('member profile not found', () => {
  test('invalid member ID shows 404 state with back link', async ({ unlockedApp: page }) => {
    await page.evaluate(() => window.location.assign('#/person/nonexistent-id'));

    const heading = page.getByRole('heading', { level: 1, name: 'Person not found' });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByText('nonexistent-id')).toHaveCount(0);

    await page.getByRole('button', { name: 'Back to team' }).click();

    await expect(page).toHaveURL(/#\/roster$/);
  });

  test('a well-formed ID that matches nobody shows the same 404 state', async ({
    unlockedApp: page,
  }) => {
    await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(9));

    await expect(page.getByRole('heading', { level: 1, name: 'Person not found' })).toBeVisible();
  });
});
