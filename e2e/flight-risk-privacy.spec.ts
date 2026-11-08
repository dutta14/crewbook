import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedId, seedMembers } from './fixtures/seedMembers';

const SECTION = 'Private Notes (visible only to you)';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const openProfile = async (page: Page, memberIndex = 0) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

const openNotes = async (page: Page, memberIndex = 0) => {
  await openProfile(page, memberIndex);
  const toggle = page.getByRole('button', { name: SECTION });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  return page.getByRole('region', { name: /^Private notes for / });
};

const addNote = async (
  page: Page,
  section: ReturnType<Page['getByRole']>,
  text: string,
  level: 'None' | 'Low' | 'Medium' | 'High',
  addLabel = 'Add Note',
) => {
  await section.getByRole('button', { name: addLabel }).click();
  await section.getByRole('textbox', { name: /^Private note/ }).fill(text);
  await section.getByRole('radio', { name: level }).check();
  await section.getByRole('button', { name: 'Save note' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(section.getByText(text)).toBeVisible();
};

const riskDot = (page: Page, name: string) =>
  page
    .getByTestId('member-row')
    .filter({ hasText: name })
    .getByText(/^Flight risk: /);

const openRoster = async (page: Page) => {
  await page.evaluate(() => window.location.assign('#/roster'));
  await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();
};

test.describe('flight risk notes', () => {
  test.beforeEach(async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
  });

  test('the section is collapsed by default and shows an empty state when opened', async ({
    unlockedApp: page,
  }) => {
    await openProfile(page);
    const toggle = page.getByRole('button', { name: SECTION });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expectNoViolations(page);

    await toggle.click();

    await expect(page.getByRole('heading', { name: 'No private notes yet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add first note' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('a high flight risk note puts a dot on the roster and survives a reload', async ({
    unlockedApp: page,
  }) => {
    const section = await openNotes(page);
    await addNote(page, section, 'Recruiter reached out twice', 'High', 'Add first note');
    await expect(section.getByRole('button', { name: 'Add Note' })).toBeFocused();

    await openRoster(page);
    await expect(riskDot(page, 'Alice Park')).toHaveText('Flight risk: High');
    await expect(riskDot(page, 'Bob Singh')).toHaveCount(0);

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await expect(riskDot(page, 'Alice Park')).toHaveText('Flight risk: High');
    await openProfile(page);
    await expect(page.getByRole('button', { name: SECTION })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(page.getByText('Recruiter reached out twice')).toHaveCount(0);
  });

  test('notes append newest first and the dot follows the latest level', async ({
    unlockedApp: page,
  }) => {
    const section = await openNotes(page);
    await addNote(page, section, 'Seems settled', 'Low', 'Add first note');
    await addNote(page, section, 'Asked about promotion timing', 'Medium');
    await addNote(page, section, 'Updated her LinkedIn', 'High');

    const notes = section.getByRole('list', { name: 'Private notes' }).getByRole('listitem');
    await expect(notes).toHaveCount(3);
    await expect(notes.locator('p')).toHaveText([
      'Updated her LinkedIn',
      'Asked about promotion timing',
      'Seems settled',
    ]);
    await expect(section.getByRole('button', { name: /edit|delete/i })).toHaveCount(0);

    await openRoster(page);
    await expect(riskDot(page, 'Alice Park')).toHaveText('Flight risk: High');
  });

  test('the confirmation guards against an accidental save and keeps the draft', async ({
    unlockedApp: page,
  }) => {
    const section = await openNotes(page);
    await section.getByRole('button', { name: 'Add first note' }).click();
    await section.getByRole('textbox', { name: /^Private note/ }).fill('Not sure yet');
    await section.getByRole('button', { name: 'Save note' }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('This is private and will never be shared');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expectNoViolations(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(section.getByRole('textbox', { name: /^Private note/ })).toHaveValue(
      'Not sure yet',
    );
    await expect(section.getByRole('list', { name: 'Private notes' })).toHaveCount(0);

    await section.getByRole('button', { name: 'Save note' }).click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(section.getByText('Not sure yet')).toBeVisible();
  });

  test('an empty note is not saved and the reason is shown', async ({ unlockedApp: page }) => {
    const section = await openNotes(page);
    await section.getByRole('button', { name: 'Add first note' }).click();

    await section.getByRole('button', { name: 'Save note' }).click();

    await expect(section.getByText('Write a note before saving')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expectNoViolations(page);
  });

  test('hiding risk indicators in settings removes the dots without deleting notes', async ({
    unlockedApp: page,
  }) => {
    const section = await openNotes(page);
    await addNote(page, section, 'Considering other offers', 'High', 'Add first note');
    await openRoster(page);
    await expect(riskDot(page, 'Alice Park')).toBeVisible();

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await page.getByRole('switch', { name: 'Hide risk indicators' }).check();
    await openRoster(page);
    await expect(riskDot(page, 'Alice Park')).toHaveCount(0);

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await page.getByRole('switch', { name: 'Hide risk indicators' }).uncheck();
    await openRoster(page);
    await expect(riskDot(page, 'Alice Park')).toBeVisible();
  });

  test('note text is never stored in plain text and the section closes when the tab is hidden', async ({
    unlockedApp: page,
  }) => {
    const section = await openNotes(page);
    await addNote(page, section, 'Plaintext canary phrase', 'Medium', 'Add first note');

    const stored = await page.evaluate(() =>
      Object.keys(localStorage)
        .map((key) => `${key}=${localStorage.getItem(key)}`)
        .join('\n'),
    );
    expect(stored).not.toContain('Plaintext canary phrase');

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByRole('button', { name: SECTION })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(page.getByText('Plaintext canary phrase')).toHaveCount(0);
  });

  test('deleting a member removes their private notes but keeps everyone else’s', async ({
    unlockedApp: page,
  }) => {
    const alice = await openNotes(page, 0);
    await addNote(page, alice, 'Alice note', 'High', 'Add first note');
    const bob = await openNotes(page, 1);
    await addNote(page, bob, 'Bob note', 'Low', 'Add first note');

    await openProfile(page, 0);
    await page.getByRole('button', { name: 'Delete Alice Park' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();

    const remaining = await page.evaluate(
      async ({ secret }) => {
        const modulePath = '/src/data/StorageManager.ts';
        const { StorageManager } = (await import(
          /* @vite-ignore */ modulePath
        )) as typeof import('../src/data/StorageManager');
        const manager = new StorageManager();
        await manager.unlock(secret);
        await manager.loadPrivate();
        const notes = manager.getPrivateData<Array<{ text: string }>>('flightRisk') ?? [];
        return notes.map((note) => note.text);
      },
      { secret: TEST_PASSPHRASE },
    );
    expect(remaining).toEqual(['Bob note']);
  });

  test('the form, levels and note list have no accessibility violations', async ({
    unlockedApp: page,
  }) => {
    const section = await openNotes(page);
    await addNote(page, section, 'Axe check note', 'Medium', 'Add first note');
    await expectNoViolations(page);

    await section.getByRole('button', { name: 'Add Note' }).click();
    await expect(section.getByRole('group', { name: 'Flight risk level' })).toBeVisible();
    await expectNoViolations(page);
  });
});
