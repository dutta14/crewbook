import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { seedId, seedMembers, seedNotes, type SeedMember } from './fixtures/seedMembers';

const member = (): SeedMember => ({
  name: 'Alex Chen',
  role: 'Software Engineer',
  level: 'L4',
  status: 'active',
  startDate: '2023-03-13',
});

const openNotes = async (page: Page) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(0));
  await page.getByRole('tab', { name: 'Notes' }).click();
  await expect(page.getByRole('textbox', { name: '1:1 Notes' })).toBeVisible();
};

const notesList = (page: Page) => page.getByRole('list', { name: '1:1 notes history' });

const todayLabel = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

test.describe('1:1 notes', () => {
  test('manager adds a 1:1 note and sees it in the notes list', async ({ unlockedApp: page }) => {
    await seedMembers(page, [member()]);
    await openNotes(page);
    await expect(page.getByText('No notes yet')).toBeVisible();

    await page.getByRole('textbox', { name: '1:1 Notes' }).fill('Discussed the Q3 roadmap');
    await page.getByRole('button', { name: 'Save Note' }).click();

    const first = notesList(page).getByRole('listitem').first();
    await expect(first).toContainText('Discussed the Q3 roadmap');
    await expect(first.locator('time')).toContainText(todayLabel());
    await expect(page.getByText('No notes yet')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: '1:1 Notes' })).toBeFocused();
    await expect(page.getByRole('textbox', { name: '1:1 Notes' })).toHaveValue('');
    await expectNoViolations(page);
  });

  test('manager searches notes and finds matching entries', async ({ unlockedApp: page }) => {
    await seedMembers(page, [member()]);
    await seedNotes(page, [
      { memberIndex: 0, content: 'Talked about the promotion cycle', hoursAgo: 72 },
      { memberIndex: 0, content: 'Vacation plans for August', hoursAgo: 48 },
      { memberIndex: 0, content: 'Promotion packet is due Friday', hoursAgo: 5 },
    ]);
    await openNotes(page);
    await expect(notesList(page).getByRole('listitem')).toHaveCount(3);

    await page.getByRole('searchbox', { name: 'Search notes' }).fill('promotion');

    await expect(notesList(page).getByRole('listitem')).toHaveCount(2);
    await expect(notesList(page).getByText('Vacation plans for August')).toHaveCount(0);
    await expect(page.locator('mark').first()).toHaveText(/promotion/i);
    await expect(page.getByText('2 notes found')).toHaveAttribute('aria-live', 'polite');
    expect(page.url()).not.toContain('promotion');

    await page.getByRole('searchbox', { name: 'Search notes' }).fill('nothing matches');
    await expect(page.getByText('No notes found')).toBeVisible();
    await expectNoViolations(page);
  });

  test('note becomes locked after 24 hours', async ({ unlockedApp: page }) => {
    await seedMembers(page, [member()]);
    await seedNotes(page, [
      { memberIndex: 0, content: 'Old conversation', hoursAgo: 30 },
      { memberIndex: 0, content: 'Recent conversation', hoursAgo: 1 },
    ]);
    await openNotes(page);

    const recent = page.getByRole('article').filter({ hasText: 'Recent conversation' });
    const old = page.getByRole('article').filter({ hasText: 'Old conversation' });
    await expect(recent.getByRole('button', { name: /^Edit note from / })).toBeVisible();
    await expect(old.getByText('Locked')).toBeVisible();
    await expect(old.getByRole('button', { name: /Edit note/ })).toHaveCount(0);

    // Keyboard focus reveals the hover-only edit button.
    const edit = recent.getByRole('button', { name: /^Edit note from / });
    await edit.focus();
    await expect(edit).toHaveCSS('opacity', '1');
  });

  test('markdown renders correctly in saved notes', async ({ unlockedApp: page }) => {
    await seedMembers(page, [member()]);
    await openNotes(page);

    await page
      .getByRole('textbox', { name: '1:1 Notes' })
      .fill(
        '# Plan\nShip **on time**\n\n- first item\n- second item\n\n<script>window.hacked = 1</script>',
      );
    await page.getByRole('button', { name: 'Save Note' }).click();

    const body = notesList(page).locator('.note-entry__body');
    await expect(body.getByRole('heading', { level: 4, name: 'Plan' })).toBeVisible();
    await expect(body.locator('strong')).toHaveText('on time');
    await expect(body.getByRole('listitem')).toHaveCount(2);
    await expect(body.locator('script')).toHaveCount(0);
    expect(await page.evaluate(() => (window as { hacked?: number }).hacked)).toBeUndefined();
  });

  test('notes and an unsent draft survive a reload', async ({ unlockedApp: page }) => {
    await seedMembers(page, [member()]);
    await openNotes(page);
    await page.getByRole('textbox', { name: '1:1 Notes' }).fill('Kept after reload');
    await page.getByRole('button', { name: 'Save Note' }).click();
    await expect(notesList(page)).toContainText('Kept after reload');

    await page.getByRole('textbox', { name: '1:1 Notes' }).fill('Unsent thought');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 6000 });
    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await openNotes(page);

    await expect(notesList(page)).toContainText('Kept after reload');
    await expect(page.getByRole('textbox', { name: '1:1 Notes' })).toHaveValue('Unsent thought');
  });

  test('manager edits a recent note', async ({ unlockedApp: page }) => {
    await seedMembers(page, [member()]);
    await seedNotes(page, [{ memberIndex: 0, content: 'Typo hete', hoursAgo: 1 }]);
    await openNotes(page);

    await page.getByRole('button', { name: /^Edit note from / }).click();
    await page.getByRole('textbox', { name: /^Edit note from / }).fill('Typo here');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(notesList(page)).toContainText('Typo here');
    await expect(notesList(page).getByText('Edited')).toBeVisible();
  });
});
