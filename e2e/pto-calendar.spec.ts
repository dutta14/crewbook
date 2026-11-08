import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedId, seedLeave, seedMembers } from './fixtures/seedMembers';

const [ALICE, BOB, CARMEN, DEV] = SEED_TEAM;

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const openCalendar = async (page: Page) => {
  await page.getByRole('link', { name: 'Calendar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'PTO Calendar' })).toBeVisible();
  await expect(page.getByRole('grid')).toBeVisible();
};

const chip = (page: Page, name: RegExp | string) => page.getByRole('button', { name }).first();

test.describe('PTO calendar', () => {
  test('explains that there is no one to schedule on a fresh install', async ({
    unlockedApp: page,
  }) => {
    await page.getByRole('link', { name: 'Calendar' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'PTO Calendar' })).toBeVisible();
    await expect(page.getByText('No one to schedule yet')).toBeVisible();
    await expectNoViolations(page);
  });

  test('adds leave, keeps it after a reload, then edits and deletes it', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [ALICE, BOB]);
    await openCalendar(page);
    await expect(page.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('button', { name: '+ Add leave' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add Leave' });
    await dialog.getByLabel(/Person/).selectOption({ label: 'Alice Park' });
    await dialog.getByLabel('Type').selectOption('sick');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Leave added')).toBeVisible();
    await expect(chip(page, /Alice Park, Sick/)).toBeVisible();

    await page.reload();
    await unlock(page);
    await expect(page.getByRole('heading', { level: 1, name: 'PTO Calendar' })).toBeVisible();
    await expect(chip(page, /Alice Park, Sick/)).toBeVisible();

    await chip(page, /Alice Park, Sick/).click();
    const edit = page.getByRole('dialog', { name: 'Edit Leave' });
    await expect(edit.getByLabel(/Person/)).toHaveValue(seedId(0));
    await edit.getByLabel('Type').selectOption('personal');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Leave updated')).toBeVisible();
    await expect(chip(page, /Alice Park, Personal/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Alice Park, Sick/ })).toHaveCount(0);

    await chip(page, /Alice Park, Personal/).click();
    await page
      .getByRole('dialog', { name: 'Edit Leave' })
      .getByRole('button', { name: 'Delete' })
      .click();
    const confirm = page.getByRole('alertdialog', { name: 'Delete leave?' });
    await expect(confirm).toContainText('Alice Park');
    await confirm.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Leave deleted')).toBeVisible();
    await expect(page.getByRole('button', { name: /Alice Park/ })).toHaveCount(0);
    await expect(page.locator('[role="gridcell"][tabindex="0"]')).toBeFocused();
  });

  test('rejects an end date before the start date', async ({ unlockedApp: page }) => {
    await seedMembers(page, [ALICE]);
    await openCalendar(page);

    await page.getByRole('button', { name: '+ Add leave' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add Leave' });
    await dialog.getByLabel(/Person/).selectOption({ label: 'Alice Park' });
    await dialog.getByLabel(/Start/).fill('2026-06-15');
    await dialog.getByLabel(/End/).fill('2026-06-10');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog.getByText("End date can't be before the start date")).toBeVisible();
    await expect(dialog.getByLabel(/End/)).toBeFocused();
    await expectNoViolations(page);
  });

  test('switches between month and week and moves through time', async ({ unlockedApp: page }) => {
    await seedMembers(page, [ALICE]);
    await openCalendar(page);
    const heading = page.getByRole('heading', { level: 2 }).first();
    const monthLabel = await heading.textContent();

    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(heading).not.toHaveText(monthLabel ?? '');
    await page.getByRole('button', { name: 'Today' }).click();
    await expect(heading).toHaveText(monthLabel ?? '');

    await page.getByRole('tab', { name: 'Week' }).click();
    await expect(page.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('grid', { name: 'Leave calendar, week view' })).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);
    await page.getByRole('button', { name: 'Next week' }).click();
    await expect(page.getByRole('button', { name: 'Previous week' })).toBeVisible();

    await page.getByRole('tab', { name: 'Month' }).click();
    await expect(page.getByRole('grid', { name: 'Leave calendar, month view' })).toBeVisible();
  });

  test('moves between days with the arrow keys and opens an entry with Enter', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [ALICE]);
    await seedLeave(page, [{ memberIndex: 0, type: 'pto', startInDays: 0, endInDays: 0 }]);
    await openCalendar(page);

    const focusedDay = page.locator('[role="gridcell"][tabindex="0"]');
    const todayKey = await focusedDay.getAttribute('data-day');
    await focusedDay.focus();
    await page.keyboard.press('ArrowRight');
    await expect(focusedDay).toBeFocused();
    await expect(focusedDay).not.toHaveAttribute('data-day', todayKey ?? '');
    await page.keyboard.press('ArrowLeft');
    await expect(focusedDay).toHaveAttribute('data-day', todayKey ?? '');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('dialog', { name: 'Edit Leave' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('warns when two people are out on the same day', async ({ unlockedApp: page }) => {
    await seedMembers(page, [ALICE, BOB, CARMEN]);
    await seedLeave(page, [
      { memberIndex: 0, type: 'pto', startInDays: 0, endInDays: 0 },
      { memberIndex: 1, type: 'sick', startInDays: 0, endInDays: 0 },
    ]);
    await openCalendar(page);

    await expect(page.getByRole('img', { name: /^Overlap: 2 people out on / })).toHaveCount(1);
    await expectNoViolations(page);
  });

  test('colour-codes every leave type, in light and dark', async ({ unlockedApp: page }) => {
    await seedMembers(page, [ALICE, BOB, CARMEN, DEV]);
    await seedLeave(page, [
      { memberIndex: 0, type: 'pto', startInDays: 0, endInDays: 0 },
      { memberIndex: 1, type: 'sick', startInDays: 0, endInDays: 0 },
      { memberIndex: 2, type: 'personal', startInDays: 0, endInDays: 0 },
      { memberIndex: 3, type: 'parental', startInDays: 0, endInDays: 0 },
    ]);
    await openCalendar(page);
    await page.getByRole('tab', { name: 'Week' }).click();

    const chipOfType = (type: string) => page.locator(`.leave-chip[data-leave-type="${type}"]`);
    const expectColours = async (colours: Record<string, string[]>) => {
      for (const [type, [background, color]] of Object.entries(colours)) {
        await expect(chipOfType(type)).toHaveCSS('background-color', background);
        await expect(chipOfType(type)).toHaveCSS('color', color);
      }
    };

    await expectColours({
      pto: ['rgb(209, 250, 229)', 'rgb(6, 95, 70)'],
      sick: ['rgb(254, 243, 199)', 'rgb(146, 64, 14)'],
      personal: ['rgb(204, 251, 241)', 'rgb(17, 94, 89)'],
      parental: ['rgb(237, 233, 254)', 'rgb(91, 33, 182)'],
    });
    await expectNoViolations(page);

    await page.getByRole('button', { name: 'Toggle dark mode' }).click();
    await expect(page.locator('body')).toHaveClass(/dark/);
    await expectColours({
      pto: ['rgb(6, 78, 59)', 'rgb(110, 231, 183)'],
      sick: ['rgb(120, 53, 15)', 'rgb(252, 211, 77)'],
      personal: ['rgb(19, 78, 74)', 'rgb(94, 234, 212)'],
      parental: ['rgb(76, 29, 149)', 'rgb(196, 181, 253)'],
    });
    await expectNoViolations(page);
  });

  test('shows who is out this week on the dashboard', async ({ unlockedApp: page }) => {
    await seedMembers(page, [ALICE, BOB]);
    await seedLeave(page, [{ memberIndex: 0, type: 'parental', startInDays: 0, endInDays: 0 }]);

    const card = page.getByRole('region', { name: "Who's Out This Week", exact: true });
    await expect(card.getByRole('link', { name: /^Alice Park, Parental, / })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'On Leave', exact: true }).getByRole('link', {
        name: 'Alice Park, Parental',
      }),
    ).toBeVisible();
  });

  test('removes a person’s leave from the encrypted store when they are deleted', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [ALICE, BOB]);
    await seedLeave(page, [
      { memberIndex: 0, type: 'sick', startInDays: 0, endInDays: 1 },
      { memberIndex: 1, type: 'pto', startInDays: 0, endInDays: 0 },
    ]);

    await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(0));
    await page.getByRole('button', { name: 'Delete Alice Park' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Alice Park removed from your team')).toBeVisible();

    const remaining = await page.evaluate(async (secret) => {
      const modulePath = '/src/data/StorageManager.ts';
      const { StorageManager } = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import('../src/data/StorageManager');
      const manager = new StorageManager();
      await manager.unlock(secret);
      await manager.loadPrivate();
      const entries = manager.getPrivateData<Array<{ memberId: string }>>('leave') ?? [];
      await manager.lock();
      return entries.map((entry) => entry.memberId);
    }, TEST_PASSPHRASE);
    expect(remaining).toEqual([seedId(1)]);
  });
});
