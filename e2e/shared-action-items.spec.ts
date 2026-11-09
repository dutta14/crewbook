import AxeBuilder from '@axe-core/playwright';
import type { Browser, Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';
import { SEED_TEAM, seedActionItems, seedId, seedMembers } from './fixtures/seedMembers';

const MANAGER = 'Morgan Lee';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

/** Creates the link from the dialog's input, so the test never depends on the clipboard. */
async function createLink(page: Page, memberIndex = 0) {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await page.getByRole('button', { name: 'Share 1:1' }).click();
  const dialog = page.getByRole('dialog', { name: /^Share 1:1 with / });
  await dialog.getByRole('textbox', { name: 'Your name' }).fill(MANAGER);
  await dialog.getByRole('button', { name: 'Create link' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Share it only with your direct report');
  await dialog.getByRole('button', { name: 'I understand' }).click();
  const link = await dialog.getByRole('textbox', { name: 'Share link' }).inputValue();
  expect(link).toContain('#/shared/');
  return link;
}

async function openAsRecipient(browser: Browser, link: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  return { page, close: () => context.close() };
}

test.describe('shared action items', () => {
  test('the engineer sees each item with its owner, due date and status', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    await seedActionItems(page, [
      { memberIndex: 0, title: 'Write the design doc', dueInDays: 7, owner: 'engineer' },
      { memberIndex: 0, title: 'Review the budget', dueInDays: 14, owner: 'manager' },
      { memberIndex: 0, title: 'Book the room', status: 'done', owner: 'manager' },
    ]);

    const recipient = await openAsRecipient(browser, await createLink(page));
    const view = recipient.page;

    const open = view.getByRole('list', { name: 'Action items' });
    await expect(open.getByRole('listitem')).toHaveCount(2);
    const mine = open.getByRole('listitem').filter({ hasText: 'Write the design doc' });
    await expect(mine).toContainText('You');
    await expect(mine.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
    await expect(open.getByRole('listitem').filter({ hasText: 'Review the budget' })).toContainText(
      MANAGER,
    );
    await expect(view.getByRole('heading', { level: 3, name: 'Open (2)' })).toBeVisible();
    await expect(view.getByText(/saved for this session only/)).toBeVisible();
    await expect(view.getByRole('button', { name: 'Done (1)' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expectNoViolations(view);
    await recipient.close();
  });

  test('ticking an item moves it to Done, announces a count and keeps focus in the list', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    await seedActionItems(page, [
      { memberIndex: 0, title: 'First task', owner: 'engineer' },
      { memberIndex: 0, title: 'Second task', owner: 'engineer' },
    ]);

    const recipient = await openAsRecipient(browser, await createLink(page));
    const view = recipient.page;

    await view.getByRole('checkbox', { name: 'Mark First task as done' }).click();

    await expect(view.getByRole('heading', { level: 3, name: 'Open (1)' })).toBeVisible();
    await expect(view.getByRole('button', { name: 'Done (1)' })).toBeVisible();
    await expect(
      view.locator('#shared-actions-title').locator('..').getByRole('status'),
    ).toHaveText('1 item done');
    await expect(view.getByRole('checkbox', { name: 'Mark Second task as done' })).toBeFocused();

    await view.getByRole('button', { name: 'Done (1)' }).click();
    const done = view.getByRole('list', { name: 'Done action items' });
    await expect(done.getByRole('checkbox', { name: 'Mark First task as done' })).toBeChecked();
    await expect(done.getByText('First task')).toHaveCSS('text-decoration-line', 'line-through');
    await expectNoViolations(view);
    await recipient.close();
  });

  test('ticking the last open item moves focus to the section heading', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    await seedActionItems(page, [{ memberIndex: 0, title: 'Only task', owner: 'engineer' }]);

    const recipient = await openAsRecipient(browser, await createLink(page));
    const view = recipient.page;

    await view.getByRole('checkbox', { name: 'Mark Only task as done' }).click();

    await expect(view.getByRole('heading', { level: 2, name: 'Action items' })).toBeFocused();
    await expect(view.getByText('No open action items')).toBeVisible();
    await recipient.close();
  });

  test('ticks last for this visit only: a reload starts from the link again', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    await seedActionItems(page, [{ memberIndex: 0, title: 'Only task', owner: 'engineer' }]);

    const recipient = await openAsRecipient(browser, await createLink(page));
    const view = recipient.page;
    await view.getByRole('checkbox', { name: 'Mark Only task as done' }).click();
    await expect(view.getByRole('button', { name: 'Done (1)' })).toBeVisible();

    await view.reload();

    await expect(view.getByRole('checkbox', { name: 'Mark Only task as done' })).not.toBeChecked();
    await expect(view.getByRole('button', { name: /^Done/ })).toHaveCount(0);
    const stored = await view.evaluate(() => localStorage.length + sessionStorage.length);
    expect(stored).toBe(0);
    await recipient.close();
  });

  test('the manager’s own list is not changed by what the engineer ticks', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    await seedActionItems(page, [{ memberIndex: 0, title: 'Only task', owner: 'engineer' }]);
    const link = await createLink(page);

    const recipient = await openAsRecipient(browser, link);
    await recipient.page.getByRole('checkbox', { name: 'Mark Only task as done' }).click();
    await recipient.close();

    await page.keyboard.press('Escape');
    await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(0));
    await page.getByRole('tab', { name: 'Notes' }).click();
    await expect(page.getByRole('checkbox', { name: 'Mark Only task as done' })).not.toBeChecked();
  });

  test('an open item past its due date says overdue in words', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    await seedActionItems(page, [
      { memberIndex: 0, title: 'Late task', dueInDays: -4, owner: 'engineer' },
      { memberIndex: 0, title: 'Fine task', dueInDays: 4, owner: 'engineer' },
    ]);

    const recipient = await openAsRecipient(browser, await createLink(page));
    const open = recipient.page.getByRole('list', { name: 'Action items' });

    await expect(open.getByRole('listitem').filter({ hasText: 'Late task' })).toContainText(
      '(overdue)',
    );
    await expect(open.getByRole('listitem').filter({ hasText: 'Fine task' })).not.toContainText(
      '(overdue)',
    );
    await recipient.close();
  });

  test('the Done section opens and closes from the keyboard', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    await seedActionItems(page, [
      { memberIndex: 0, title: 'Finished task', status: 'done', owner: 'manager' },
    ]);

    const recipient = await openAsRecipient(browser, await createLink(page));
    const toggle = recipient.page.getByRole('button', { name: 'Done (1)' });

    await toggle.focus();
    await recipient.page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(recipient.page.getByText('Finished task')).toBeVisible();
    await recipient.page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(recipient.page.getByText('Finished task')).toHaveCount(0);
    await recipient.close();
  });

  test('with no action items the section shows a plain empty state', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));

    const recipient = await openAsRecipient(browser, await createLink(page));

    await expect(recipient.page.getByText('No action items yet')).toBeVisible();
    await expect(recipient.page.getByText(/saved for this session only/)).toHaveCount(0);
    await expect(recipient.page.getByRole('checkbox')).toHaveCount(0);
    await recipient.close();
  });

  test('an item the manager leaves out never reaches the link', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    await seedActionItems(page, [
      { memberIndex: 0, title: 'Visible task', owner: 'engineer' },
      { memberIndex: 0, title: 'SECRET-TASK-SENTINEL', owner: 'manager', includeInShare: false },
    ]);

    await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(0));
    await page.getByRole('tab', { name: 'Notes' }).click();
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: 'SECRET-TASK-SENTINEL' })
        .getByText('Not shared'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Share 1:1' }).click();
    const dialog = page.getByRole('dialog', { name: /^Share 1:1 with / });
    await dialog.getByRole('textbox', { name: 'Your name' }).fill(MANAGER);
    await dialog.getByRole('button', { name: 'Create link' }).click();
    const preview = dialog.getByRole('list', { name: 'Action items in this link' });
    await expect(preview).toContainText('Visible task');
    await expect(preview).not.toContainText('SECRET-TASK-SENTINEL');
    await dialog.getByRole('button', { name: 'I understand' }).click();
    const link = await dialog.getByRole('textbox', { name: 'Share link' }).inputValue();

    const recipient = await openAsRecipient(browser, link);
    await expect(recipient.page.getByText('Visible task')).toBeVisible();
    await expect(recipient.page.locator('body')).not.toContainText('SECRET-TASK-SENTINEL');
    await recipient.close();
  });
});
