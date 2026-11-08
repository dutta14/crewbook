import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedActionItems, seedId, seedMembers, seedNotes } from './fixtures/seedMembers';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const openProfile = async (page: Page, memberIndex = 0) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

const startLive = async (page: Page) => {
  await page.getByRole('button', { name: 'Start 1:1' }).click();
  const dialog = page.getByRole('dialog', { name: /^1:1 with / });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: '1:1 notes' })).toBeFocused();
  return dialog;
};

const endLive = async (page: Page) => {
  await page.getByRole('button', { name: 'End 1:1 meeting and save' }).click();
  await expect(page.getByRole('dialog', { name: /^1:1 with / })).toHaveCount(0);
};

const openNotesTab = async (page: Page) => {
  await page.getByRole('tab', { name: 'Notes' }).click();
  await expect(page.getByRole('list', { name: '1:1 notes history' })).toBeVisible();
};

test.describe('1:1 live mode', () => {
  test.beforeEach(async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
  });

  test('manager runs a 1:1 with quick capture, ends it, and finds the note and action item', async ({
    unlockedApp: page,
  }) => {
    await openProfile(page);
    const dialog = await startLive(page);
    await expect(dialog.getByRole('heading', { level: 2, name: 'Alice Park' })).toBeVisible();
    await expect(dialog.getByText(/Live mode captures notes as you type/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Dismiss' }).click();
    await expect(dialog.getByText(/Live mode captures notes as you type/)).toHaveCount(0);

    await dialog.getByRole('textbox', { name: '1:1 notes' }).fill('Talked about the launch');
    await dialog.getByRole('button', { name: 'Add action item' }).click();
    await dialog.getByRole('textbox', { name: 'Action item title' }).fill('Send the launch plan');
    await dialog.getByRole('textbox', { name: 'Action item title' }).press('Enter');
    await expect(page.getByText('Action item added')).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: '1:1 notes' })).toBeFocused();
    await expectNoViolations(page);

    await endLive(page);
    await expect(page.getByText('1:1 saved')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start 1:1' })).toBeFocused();

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await openNotesTab(page);
    const history = page.getByRole('list', { name: '1:1 notes history' });
    await expect(history).toContainText('Talked about the launch');
    await expect(history).toContainText('Action item: Send the launch plan');
    await expect(page.getByRole('list', { name: 'Open action items' })).toContainText(
      'Send the launch plan',
    );
  });

  test('a decision and a follow-up land in the notes but create no action items', async ({
    unlockedApp: page,
  }) => {
    await openProfile(page);
    const dialog = await startLive(page);
    const notes = dialog.getByRole('textbox', { name: '1:1 notes' });

    await dialog.getByRole('button', { name: 'Add decision' }).click();
    await dialog.getByRole('textbox', { name: 'Decision title' }).fill('Ship on Friday');
    await dialog.getByRole('textbox', { name: 'Decision title' }).press('Enter');
    await dialog.getByRole('button', { name: 'Add follow-up' }).click();
    await dialog.getByRole('textbox', { name: 'Follow-up title' }).fill('Check in next week');
    await dialog.getByRole('textbox', { name: 'Follow-up title' }).press('Enter');

    await expect(notes).toHaveValue(
      '- **Decision:** Ship on Friday\n- **Follow-up:** Check in next week',
    );
    await endLive(page);
    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await openNotesTab(page);
    await expect(page.getByRole('list', { name: '1:1 notes history' })).toContainText(
      'Ship on Friday',
    );
    await expect(page.getByRole('list', { name: 'Open action items' })).toHaveCount(0);
  });

  test('notes auto-save and come back after a reload without ending the 1:1', async ({
    unlockedApp: page,
  }) => {
    await openProfile(page);
    const dialog = await startLive(page);
    await dialog.getByRole('textbox', { name: '1:1 notes' }).fill('Half-finished thought');

    const status = dialog.getByRole('status');
    await expect(status).toHaveText('Saved', { timeout: 15_000 });
    expect(await dialog.getByRole('status').getAttribute('aria-live')).toBe('polite');

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await expect(page.getByRole('dialog', { name: /^1:1 with / })).toHaveCount(0);
    const reopened = await startLive(page);
    await expect(reopened.getByRole('textbox', { name: '1:1 notes' })).toHaveValue(
      'Half-finished thought',
    );
  });

  test('the sidebar shows open action items and the last notes, and checking an item completes it', async ({
    unlockedApp: page,
  }) => {
    await seedNotes(page, [
      { memberIndex: 0, content: `Earlier chat ${'x'.repeat(260)}`, hoursAgo: 200 },
    ]);
    await seedActionItems(page, [
      { memberIndex: 0, title: 'Review the offer letter' },
      { memberIndex: 0, title: 'Already shipped', status: 'done' },
    ]);
    await openProfile(page);
    const dialog = await startLive(page);
    const sidebar = dialog.getByRole('complementary', { name: '1:1 context' });
    await expect(sidebar.getByRole('checkbox', { name: 'Review the offer letter' })).toBeVisible();
    await expect(sidebar.getByText('Already shipped')).toHaveCount(0);
    await expect(sidebar.getByText(/^Earlier chat x+…$/)).toBeVisible();
    await sidebar.getByRole('button', { name: 'Show more' }).click();
    await expect(sidebar.getByText(/^Earlier chat x+$/)).toBeVisible();
    await expect(sidebar.getByRole('heading', { name: 'Prep prompts' })).toBeVisible();

    await sidebar.getByRole('checkbox', { name: 'Review the offer letter' }).check();
    await endLive(page);
    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    const again = await startLive(page);
    await expect(again.getByText('Nothing open from earlier 1:1s.')).toBeVisible();
  });

  test('Ctrl/Cmd+Shift+A opens the action item form, and turning shortcuts off stops it', async ({
    unlockedApp: page,
  }) => {
    await openProfile(page);
    const dialog = await startLive(page);

    await page.keyboard.press('ControlOrMeta+Shift+A');
    await expect(dialog.getByRole('textbox', { name: 'Action item title' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog.getByRole('textbox', { name: 'Action item title' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Add action item' })).toBeFocused();

    await page.keyboard.press('ControlOrMeta+Shift+D');
    await expect(dialog.getByRole('textbox', { name: 'Decision title' })).toBeFocused();

    await dialog.getByRole('checkbox', { name: 'Keyboard shortcuts' }).uncheck();
    await expect(dialog.getByRole('checkbox', { name: 'Keyboard shortcuts' })).not.toBeChecked();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await page.keyboard.press('ControlOrMeta+Shift+A');
    await expect(dialog.getByRole('textbox', { name: 'Action item title' })).toHaveCount(0);
  });

  test('the timer starts at 0:00 and counts up', async ({ unlockedApp: page }) => {
    await openProfile(page);
    const dialog = await startLive(page);
    const timer = dialog.getByRole('timer');

    await expect(timer).toHaveText(/^0:0[0-9]$/);
    await expect(timer).not.toHaveText('0:00');
    await expect(timer).not.toHaveAttribute('aria-live', 'polite');
  });

  test('Escape does not close live mode and Tab stays inside it', async ({ unlockedApp: page }) => {
    await openProfile(page);
    const dialog = await startLive(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();

    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
  });

  test('after End 1:1 the mood prompt appears on the profile when tracking is on', async ({
    unlockedApp: page,
  }) => {
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('switch', { name: 'Track energy/mood after 1:1s' }).check();
    await expect(page.getByRole('switch', { name: 'Track energy/mood after 1:1s' })).toBeChecked();
    await openProfile(page);

    await startLive(page);
    await endLive(page);

    const group = page.getByRole('radiogroup', { name: 'Energy level' });
    await expect(group).toBeVisible();
    await group.getByRole('radio', { name: 'Good energy' }).click();
    await expect(group.getByRole('radio', { name: 'Good energy' })).toBeChecked();
  });
});
