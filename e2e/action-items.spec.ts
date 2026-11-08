import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import {
  SEED_TEAM,
  seedActionItems,
  seedId,
  seedMembers,
  type SeedMember,
} from './fixtures/seedMembers';

const members = (): SeedMember[] => SEED_TEAM.slice(0, 3);

const openNotes = async (page: Page, memberIndex = 0) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await page.getByRole('tab', { name: 'Notes' }).click();
  await expect(page.getByRole('textbox', { name: '1:1 Notes' })).toBeVisible();
};

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const actionList = (page: Page, status = 'Open') =>
  page.getByRole('list', { name: `${status} action items` });

test.describe('action items', () => {
  test('manager creates an action item from the Notes tab and it persists', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, members());
    await openNotes(page);
    await expect(page.getByText('No action items. Create one during your next 1:1.')).toBeVisible();

    await page.getByRole('button', { name: '+ Action Item' }).click();
    await expect(page.getByLabel('Title')).toBeFocused();
    await page.getByLabel('Title').fill('Send the updated offer letter');
    await page.getByLabel('Owner').selectOption({ label: 'Alice Park' });
    await page.getByLabel('Due date (optional)').fill('2099-03-05');
    await expectNoViolations(page);
    await page.getByLabel('Title').press('Enter');

    const row = actionList(page).getByRole('listitem').first();
    await expect(row).toContainText('Send the updated offer letter');
    await expect(row).toContainText('Alice Park');
    await expect(row.locator('time')).toHaveAttribute('datetime', '2099-03-05');
    await expect(page.getByText('Action item added')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Action Item' })).toBeFocused();

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await openNotes(page);
    await expect(actionList(page)).toContainText('Send the updated offer letter');
  });

  test('empty title is rejected with an announced error', async ({ unlockedApp: page }) => {
    await seedMembers(page, members());
    await openNotes(page);

    await page.getByRole('button', { name: '+ Action Item' }).click();
    await page.getByLabel('Title').press('Enter');

    await expect(page.getByRole('alert').filter({ hasText: 'Enter a title' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Title')).toHaveCount(0);
  });

  test('open items carry forward to the next visit until they are done', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, members());
    await seedActionItems(page, [
      { memberIndex: 0, title: 'Carried over item', dueInDays: 3 },
      { memberIndex: 0, title: 'Already finished', status: 'done' },
      { memberIndex: 1, title: 'Someone else’s item' },
    ]);
    await openNotes(page);

    await expect(actionList(page).getByRole('listitem')).toHaveCount(1);
    await expect(actionList(page)).toContainText('Carried over item');
    await expect(page.getByText('Someone else’s item')).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Mark Carried over item as done' }).check();
    await page.getByRole('radio', { name: 'Done' }).click();
    await expect(actionList(page, 'Done')).toContainText('Carried over item');
    await expect(actionList(page, 'Done')).toContainText('Already finished');
  });

  test('marking done offers Undo for five seconds and Undo reopens the item', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, members());
    await seedActionItems(page, [{ memberIndex: 0, title: 'Book the offsite room' }]);
    await openNotes(page);

    const checkbox = page.getByRole('checkbox', { name: 'Mark Book the offsite room as done' });
    await checkbox.check();
    const undo = page.getByRole('button', { name: 'Undo' });
    await expect(undo).toBeVisible();
    await expect(
      page.getByText('Book the offsite room marked as done. Undo available.'),
    ).toBeAttached();
    await expectNoViolations(page);

    await undo.click();
    await expect(undo).toHaveCount(0);
    await expect(checkbox).not.toBeChecked();
    await expect(checkbox).toBeFocused();

    await checkbox.check();
    await expect(undo).toBeVisible();
    await expect(undo).toHaveCount(0, { timeout: 7000 });
    await expect(checkbox).toBeChecked();

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await openNotes(page);
    await page.getByRole('radio', { name: 'Done' }).click();
    await expect(actionList(page, 'Done')).toContainText('Book the offsite room');
  });

  test('overdue items show red text and a visible Overdue label', async ({ unlockedApp: page }) => {
    await seedMembers(page, members());
    await seedActionItems(page, [
      { memberIndex: 0, title: 'Past due thing', dueInDays: -2 },
      { memberIndex: 0, title: 'Future thing', dueInDays: 5 },
    ]);
    await openNotes(page);

    const overdue = actionList(page).getByRole('listitem').filter({ hasText: 'Past due thing' });
    await expect(overdue.getByText('Overdue')).toBeVisible();
    await expect(overdue.locator('.action-item__due')).toHaveCSS('color', 'rgb(220, 38, 38)');
    const future = actionList(page).getByRole('listitem').filter({ hasText: 'Future thing' });
    await expect(future.getByText('Overdue')).toHaveCount(0);
    await expectNoViolations(page);
  });

  test('global view lists items across members, sorts and filters by person', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, members());
    await seedActionItems(page, [
      { memberIndex: 0, title: 'Alice later', dueInDays: 20 },
      { memberIndex: 1, title: 'Bob sooner', dueInDays: 2 },
      { memberIndex: 2, title: 'Carmen undated' },
      { memberIndex: 2, title: 'Carmen finished', status: 'done' },
    ]);

    await page.getByRole('link', { name: 'Action Items' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Action Items' })).toBeFocused();
    const table = page.getByRole('table', { name: 'Action items across team' });
    const titles = table.locator('tbody tr td:nth-child(2)');
    await expect(titles).toHaveText(['Bob sooner', 'Alice later', 'Carmen undated']);
    await expect(page.getByRole('columnheader', { name: /Due date/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await page.getByRole('button', { name: /Due date/ }).click();
    await expect(titles).toHaveText(['Alice later', 'Bob sooner', 'Carmen undated']);
    await expect(page.getByRole('columnheader', { name: /Due date/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    await page.getByLabel('Person').selectOption({ label: 'Bob Singh' });
    await expect(titles).toHaveText(['Bob sooner']);
    expect(page.url()).not.toContain('Bob');
    await expectNoViolations(page);

    await page.getByLabel('Person').selectOption({ label: 'All team members' });
    await page.getByRole('radio', { name: 'All' }).click();
    await expect(titles).toHaveCount(4);

    await page.getByRole('link', { name: 'Bob Singh' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Bob Singh' })).toBeVisible();
  });

  test('global view shows the empty state when nothing is open', async ({ unlockedApp: page }) => {
    await seedMembers(page, members());

    await page.getByRole('link', { name: 'Action Items' }).click();

    await expect(page.getByText('No open action items across your team. Nice work!')).toBeVisible();
    await expectNoViolations(page);
  });

  test('deleting a member removes their action items from the global view', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, members());
    await seedActionItems(page, [
      { memberIndex: 0, title: 'Alice item' },
      { memberIndex: 1, title: 'Bob item' },
    ]);
    await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(0));
    await page.getByRole('button', { name: 'Delete Alice Park' }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(page.getByText('Alice Park removed from your team')).toBeVisible();

    await page.getByRole('link', { name: 'Action Items' }).click();
    await expect(page.getByRole('cell', { name: 'Bob item' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Alice item' })).toHaveCount(0);
  });
});
