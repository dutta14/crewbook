import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';
import { SEED_TEAM, seedMembers } from './fixtures/seedMembers';

const HEADER = 'name,role,level,start_date,email,manager,status';
const rows = (page: Page) => page.getByTestId('member-row');
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Import team from CSV' });
const previewRows = (page: Page) => page.getByTestId('csv-preview-row');

const csvFile = (lines: string[], name = 'team.csv') => ({
  name,
  mimeType: 'text/csv',
  buffer: Buffer.from(`${lines.join('\n')}\n`),
});

const goToRoster = async (page: Page) => {
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Team' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();
};

const openImport = async (page: Page) => {
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
};

const upload = async (page: Page, lines: string[]) => {
  await dialog(page).getByLabel('Choose a .csv file').setInputFiles(csvFile(lines));
  await expect(
    dialog(page).getByRole('heading', { name: 'Step 2: Preview and import' }),
  ).toBeVisible();
};

const importButton = (page: Page, label: string | RegExp) =>
  dialog(page).getByRole('button', { name: label });

const FIVE_VALID = [
  HEADER,
  'Ada Lovelace,Engineer,L5,2024-02-01,ada@example.com,,active',
  'Grace Hopper,Admiral,L7,2024-03-01,grace@example.com,,active',
  'Alan Turing,Researcher,L6,2024-04-01,alan@example.com,,new_hire',
  'Edsger Dijkstra,Professor,L6,,edsger@example.com,,',
  'Barbara Liskov,Architect,L7,2024-05-01,barbara@example.com,,on_leave',
];

test.describe('CSV import', () => {
  test.beforeEach(async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM);
    await goToRoster(page);
  });

  test('manager imports five members from a CSV and sees them in the roster', async ({ page }) => {
    await openImport(page);
    await upload(page, FIVE_VALID);
    await expect(previewRows(page)).toHaveCount(5);

    await importButton(page, 'Import 5 members').click();

    await expect(dialog(page)).toBeHidden();
    await expect(page.getByText('Imported 5 of 5 members')).toBeVisible();
    await expect(rows(page)).toHaveCount(9);
    for (const name of ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Edsger Dijkstra']) {
      await expect(rows(page).filter({ hasText: name })).toHaveCount(1);
    }
  });

  test('invalid rows are flagged, unchecked, and skipped on import', async ({ page }) => {
    await openImport(page);
    await upload(page, [
      HEADER,
      'Ada Lovelace,Engineer,L5,2024-02-01,ada@example.com,,active',
      ',Engineer,L5,2024-02-01,nameless@example.com,,active',
      'Grace Hopper,Admiral,L7,2024-03-01,grace@example.com,,active',
      'Alan Turing,Researcher,L6,2024-04-01,not-an-email,,active',
      'Barbara Liskov,Architect,L7,2024-05-01,barbara@example.com,,on_leave',
    ]);

    await expect(previewRows(page)).toHaveCount(5);
    await expect(dialog(page).getByText('Missing name')).toBeVisible();
    await expect(dialog(page).getByText('Invalid email format')).toBeVisible();
    await expect(dialog(page).getByRole('checkbox', { checked: false })).toHaveCount(2);
    await expect(dialog(page).getByRole('checkbox', { checked: true })).toHaveCount(3);

    await importButton(page, 'Import 3 members').click();

    await expect(page.getByText('Imported 3 of 5 members (2 skipped)')).toBeVisible();
    await expect(rows(page)).toHaveCount(7);
    await expect(rows(page).filter({ hasText: 'Alan Turing' })).toHaveCount(0);
  });

  test('deselecting rows imports only the selected ones', async ({ page }) => {
    await openImport(page);
    await upload(page, FIVE_VALID.slice(0, 5));

    await dialog(page).getByRole('checkbox', { name: 'Select Grace Hopper for import' }).uncheck();
    await dialog(page).getByRole('checkbox', { name: 'Select Alan Turing for import' }).uncheck();
    await expect(importButton(page, 'Import 2 members')).toBeVisible();
    await importButton(page, 'Import 2 members').click();

    await expect(page.getByText('Imported 2 of 4 members (2 skipped)')).toBeVisible();
    await expect(rows(page)).toHaveCount(6);
    await expect(rows(page).filter({ hasText: 'Ada Lovelace' })).toHaveCount(1);
    await expect(rows(page).filter({ hasText: 'Edsger Dijkstra' })).toHaveCount(1);
    await expect(rows(page).filter({ hasText: 'Grace Hopper' })).toHaveCount(0);
  });

  test('the template link downloads a CSV file', async ({ page }) => {
    await openImport(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog(page).getByRole('link', { name: 'Download CSV template' }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    await expect(dialog(page)).toBeVisible();
  });

  test('a headers-only file shows no rows and keeps import disabled', async ({ page }) => {
    await openImport(page);
    await upload(page, [HEADER]);

    await expect(previewRows(page)).toHaveCount(0);
    await expect(importButton(page, /^Import 0 members?$/)).toBeDisabled();
  });

  test('a non-CSV file is rejected with an inline error', async ({ page }) => {
    await openImport(page);

    await dialog(page)
      .getByLabel('Choose a .csv file')
      .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });

    await expect(dialog(page).getByRole('alert')).toBeVisible();
    await expect(
      dialog(page).getByRole('heading', { name: 'Step 2: Preview and import' }),
    ).toHaveCount(0);
  });

  test('Escape closes the dialog and returns focus to the Import CSV button', async ({ page }) => {
    await openImport(page);

    await page.keyboard.press('Escape');

    await expect(dialog(page)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Import CSV', exact: true })).toBeFocused();
    await expect(rows(page)).toHaveCount(4);
  });

  test('both steps have no serious accessibility violations', async ({ page }) => {
    // Axe samples contrast mid-fade otherwise, so motion is turned off for a stable reading.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openImport(page);
    const stepOne = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(stepOne.violations).toEqual([]);

    await upload(page, FIVE_VALID.slice(0, 3).concat(',Engineer,L5,,,,'));
    const stepTwo = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(stepTwo.violations).toEqual([]);
  });

  test('the dialog is usable at a phone width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await openImport(page);
    await upload(page, FIVE_VALID.slice(0, 3));

    const box = await dialog(page).boundingBox();
    expect(box?.width ?? Infinity).toBeLessThanOrEqual(375);
    await expect(importButton(page, 'Import 2 members')).toBeVisible();
  });
});
