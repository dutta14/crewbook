import AxeBuilder from '@axe-core/playwright';
import type { Browser, Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedId, seedMembers, seedNotes } from './fixtures/seedMembers';

const MANAGER = 'Morgan Lee';
const NOTE_A = 'NOTE-A-body';
const NOTE_B = 'NOTE-B-body';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const openNotes = async (page: Page) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(0));
  await page.getByRole('tab', { name: 'Notes' }).click();
  await expect(page.getByRole('textbox', { name: '1:1 Notes' })).toBeVisible();
};

const noteCard = (page: Page, text: string) => page.getByRole('article').filter({ hasText: text });
const toggleOf = (page: Page, text: string) =>
  noteCard(page, text).getByRole('button', { name: /^Toggle note visibility/ });

/** Creates a new link each time, since a link is a snapshot of what was shared when it was made. */
async function createLink(page: Page) {
  await page.getByRole('button', { name: 'Share 1:1' }).click();
  const dialog = page.getByRole('dialog', { name: /^Share 1:1 with / });
  await dialog.getByRole('textbox', { name: 'Your name' }).fill(MANAGER);
  await dialog.getByRole('button', { name: /^Create (new )?link$/ }).click();
  await dialog.getByRole('button', { name: 'I understand' }).click();
  const link = await dialog.getByRole('textbox', { name: 'Share link' }).inputValue();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  return link;
}

async function readSharedPage(browser: Browser, link: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  await expect(page.getByRole('heading', { level: 1, name: `1:1 with ${MANAGER}` })).toBeVisible();
  const text = await page.locator('body').innerText();
  await context.close();
  return text;
}

test.describe('shared and private notes', () => {
  test('a note is private until shared, and only a new link shows it to the engineer', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await seedNotes(page, [{ memberIndex: 0, content: NOTE_A, hoursAgo: 2 }]);
    await openNotes(page);

    await expect(noteCard(page, NOTE_A)).toHaveAccessibleName('Private note');
    const before = await readSharedPage(browser, await createLink(page));
    expect(before).not.toContain(NOTE_A);

    await toggleOf(page, NOTE_A).click();
    const dialog = page.getByRole('alertdialog', { name: 'Share this note?' });
    await expect(dialog.getByRole('alert')).toContainText(
      'This note will become visible to Alice Park.',
    );
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expectNoViolations(page);
    await dialog.getByRole('button', { name: 'Share Note' }).click();

    await expect(noteCard(page, NOTE_A)).toHaveAccessibleName('Shared note');
    await expect(toggleOf(page, NOTE_A)).toHaveAttribute('aria-pressed', 'true');
    await expect(toggleOf(page, NOTE_A)).toBeFocused();

    const after = await readSharedPage(browser, await createLink(page));
    expect(after).toContain(NOTE_A);
  });

  test('making a shared note private takes effect at once, without a prompt, and a new link omits it', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await seedNotes(page, [{ memberIndex: 0, content: NOTE_A, hoursAgo: 2, visibility: 'shared' }]);
    await openNotes(page);
    expect(await readSharedPage(browser, await createLink(page))).toContain(NOTE_A);

    await toggleOf(page, NOTE_A).click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(noteCard(page, NOTE_A)).toHaveAccessibleName('Private note');
    expect(await readSharedPage(browser, await createLink(page))).not.toContain(NOTE_A);
  });

  test('the visibility of a note survives a reload and a lock', async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await seedNotes(page, [
      { memberIndex: 0, content: NOTE_A, hoursAgo: 2 },
      { memberIndex: 0, content: NOTE_B, hoursAgo: 3, visibility: 'shared' },
    ]);
    await openNotes(page);
    await toggleOf(page, NOTE_A).click();
    await page.getByRole('button', { name: 'Share Note' }).click();
    await expect(noteCard(page, NOTE_A)).toHaveAccessibleName('Shared note');
    await toggleOf(page, NOTE_B).click();
    await expect(noteCard(page, NOTE_B)).toHaveAccessibleName('Private note');

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await openNotes(page);

    await expect(noteCard(page, NOTE_A)).toHaveAccessibleName('Shared note');
    await expect(noteCard(page, NOTE_B)).toHaveAccessibleName('Private note');
  });

  test('Make all shared confirms how many notes change, and Make all private needs no prompt', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await seedNotes(page, [
      { memberIndex: 0, content: NOTE_A, hoursAgo: 2 },
      { memberIndex: 0, content: NOTE_B, hoursAgo: 3 },
    ]);
    await openNotes(page);

    await page.getByRole('button', { name: /^Make all shared/ }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Share 2 notes?' });
    await expect(dialog.getByRole('alert')).toContainText(
      '2 notes will become visible to Alice Park.',
    );
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('article', { name: 'Shared note' })).toHaveCount(0);

    await page.getByRole('button', { name: /^Make all shared/ }).click();
    await dialog.getByRole('button', { name: 'Share Notes' }).click();
    await expect(page.getByRole('article', { name: 'Shared note' })).toHaveCount(2);
    const shared = await readSharedPage(browser, await createLink(page));
    expect(shared).toContain(NOTE_A);
    expect(shared).toContain(NOTE_B);

    await page.getByRole('button', { name: /^Make all private/ }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('article', { name: 'Private note' })).toHaveCount(2);
    const hidden = await readSharedPage(browser, await createLink(page));
    expect(hidden).not.toContain(NOTE_A);
    expect(hidden).not.toContain(NOTE_B);
    await expectNoViolations(page);
  });

  test('a default of shared in Settings applies to new notes only', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await seedNotes(page, [{ memberIndex: 0, content: NOTE_A, hoursAgo: 2 }]);
    await openNotes(page);
    await page.getByRole('textbox', { name: '1:1 Notes' }).fill('Fresh private one');
    await page.getByRole('button', { name: 'Save Note' }).click();
    await expect(noteCard(page, 'Fresh private one')).toHaveAccessibleName('Private note');

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('radio', { name: /Shared/ }).check();
    await expectNoViolations(page);
    await openNotes(page);
    await expect(page.getByText(/New notes are shared with Alice Park/)).toBeVisible();
    await page.getByRole('textbox', { name: '1:1 Notes' }).fill('Fresh shared one');
    await page.getByRole('button', { name: 'Save Note' }).click();

    await expect(noteCard(page, 'Fresh shared one')).toHaveAccessibleName('Shared note');
    await expect(noteCard(page, 'Fresh private one')).toHaveAccessibleName('Private note');
    await expect(noteCard(page, NOTE_A)).toHaveAccessibleName('Private note');
  });
});
