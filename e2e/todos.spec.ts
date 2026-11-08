import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedMembers, seedTodos } from './fixtures/seedMembers';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const openTasks = async (page: Page) => {
  await page.getByRole('link', { name: 'Tasks' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'My Tasks' })).toBeVisible();
};

const taskNames = (page: Page) => page.getByRole('list').getByRole('checkbox');

const addTask = async (page: Page, title: string) => {
  await page.getByRole('button', { name: '+ Add task' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add task' });
  await dialog.getByRole('textbox', { name: /Title/ }).fill(title);
  return dialog;
};

test.describe('personal tasks', () => {
  test('shows the empty state, and no accessibility violations, on a fresh install', async ({
    unlockedApp: page,
  }) => {
    await openTasks(page);

    await expect(page.getByText('All clear! No pending tasks.')).toBeVisible();
    await expectNoViolations(page);
  });

  test('adds a task, keeps it after a reload and unlock, then edits and deletes it', async ({
    unlockedApp: page,
  }) => {
    await openTasks(page);
    const dialog = await addTask(page, 'Prepare calibration notes');
    await dialog.getByRole('textbox', { name: 'Description' }).fill('Compare against the rubric');
    await dialog.getByLabel('Priority').selectOption('high');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Task added')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add task' })).toBeFocused();
    await expect(page.getByRole('checkbox', { name: 'Prepare calibration notes' })).toBeVisible();
    await expect(page.getByText('High priority')).toBeVisible();

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await openTasks(page);
    await expect(page.getByRole('checkbox', { name: 'Prepare calibration notes' })).toBeVisible();

    await page.getByRole('button', { name: 'Task actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit task' });
    await expect(edit.getByRole('textbox', { name: 'Description' })).toHaveValue(
      'Compare against the rubric',
    );
    await edit.getByRole('textbox', { name: /Title/ }).fill('Finish calibration notes');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('checkbox', { name: 'Finish calibration notes' })).toBeVisible();

    await page.getByRole('button', { name: 'Task actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).not.toContainText('Finish calibration notes');
    await confirm.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('All clear! No pending tasks.')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add task' })).toBeFocused();
  });

  test('submits the form with Enter and rejects an empty title', async ({ unlockedApp: page }) => {
    await openTasks(page);
    await page.getByRole('button', { name: '+ Add task' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add task' });

    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByText('Enter a title for this task')).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: /Title/ })).toBeFocused();

    await dialog.getByRole('textbox', { name: /Title/ }).fill('Entered with the keyboard');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('checkbox', { name: 'Entered with the keyboard' })).toBeVisible();
  });

  test('closes the form with Escape and returns focus to the Add button', async ({
    unlockedApp: page,
  }) => {
    await openTasks(page);
    await addTask(page, 'Never saved');

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '+ Add task' })).toBeFocused();
    await expect(page.getByText('All clear! No pending tasks.')).toBeVisible();
  });

  test('completes a task from the keyboard and keeps it done after a reload', async ({
    unlockedApp: page,
  }) => {
    await seedTodos(page, [{ title: 'Send feedback' }]);
    await openTasks(page);

    const checkbox = page.getByRole('checkbox', { name: 'Send feedback' });
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await expect(page.getByRole('status').filter({ hasText: 'marked as done' })).toHaveText(
      'Task Send feedback marked as done',
    );

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await openTasks(page);
    await expect(page.getByRole('checkbox', { name: 'Send feedback' })).toBeChecked();
  });

  test('sorts by due date or priority and filters by status, priority and person', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await seedTodos(page, [
      { title: 'Later low', dueInDays: 30, priority: 'low' },
      { title: 'Soon high', dueInDays: 2, priority: 'high', memberIndex: 1 },
      { title: 'Undated medium' },
      { title: 'Finished', status: 'done', memberIndex: 0 },
    ]);
    await openTasks(page);

    await expect(taskNames(page)).toHaveCount(4);
    await expect(taskNames(page).first()).toHaveAccessibleName('Soon high');
    await page.getByLabel('Sort by').selectOption('priority');
    await expect(taskNames(page).first()).toHaveAccessibleName('Soon high');
    await expect(taskNames(page).last()).toHaveAccessibleName('Later low');

    await page.getByLabel('Status').selectOption('done');
    await expect(taskNames(page)).toHaveCount(1);
    await expect(taskNames(page).first()).toHaveAccessibleName('Finished');
    await page.getByLabel('Status').selectOption('');

    await page.getByLabel('Person').selectOption({ label: SEED_TEAM[1].name });
    await expect(taskNames(page)).toHaveCount(1);
    await expect(taskNames(page).first()).toHaveAccessibleName('Soon high');
    await page.getByLabel('Priority').selectOption('low');
    await expect(page.getByText('No tasks match these filters.')).toBeVisible();
  });

  test('flags overdue tasks in text, not only colour, and has no accessibility violations', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    await seedTodos(page, [
      { title: 'Overdue thing', dueInDays: -3, priority: 'high', memberIndex: 0 },
      { title: 'Fine thing', dueInDays: 5, status: 'in_progress' },
    ]);
    await openTasks(page);

    const overdue = page.getByRole('listitem').filter({ hasText: 'Overdue thing' });
    await expect(overdue.getByText('(overdue)')).toBeAttached();
    await expect(page.getByRole('listitem').filter({ hasText: 'Fine thing' })).not.toContainText(
      '(overdue)',
    );
    await expectNoViolations(page);
  });

  test('the Tasks link in the sidebar is marked as the current page', async ({
    unlockedApp: page,
  }) => {
    await openTasks(page);

    await expect(page.getByRole('link', { name: 'Tasks' })).toHaveAttribute('aria-current', 'page');
  });
});
