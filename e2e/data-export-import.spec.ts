import AxeBuilder from '@axe-core/playwright';
import type { Download, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TEST_PASSPHRASE, expect, setUpPassphrase, test, unlock } from './fixtures/auth';
import {
  SEED_TEAM,
  seedActionItems,
  seedFeedback,
  seedMembers,
  seedNotes,
  seedSkills,
} from './fixtures/seedMembers';

const NEW_DEVICE_PASSPHRASE = 'a different passphrase entirely';
const PRIVATE_NOTE = 'Considering a move to the platform team';
const FEEDBACK_TEXT = 'Handled the incident review with great care';
const SKILL_NAME = 'Distributed tracing';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const openSettings = async (page: Page) => {
  await page.evaluate(() => window.location.assign('#/settings'));
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  const section = page.getByRole('region', { name: 'Data Management' });
  await expect(section).toBeVisible();
  return section;
};

const openRoster = async (page: Page) => {
  await page.evaluate(() => window.location.assign('#/roster'));
  await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();
};

const seedEverything = async (page: Page) => {
  await seedMembers(page, SEED_TEAM);
  await seedNotes(page, [
    { memberIndex: 0, content: PRIVATE_NOTE, hoursAgo: 5 },
    { memberIndex: 0, content: 'Shared plan for the quarter', hoursAgo: 30, visibility: 'shared' },
  ]);
  await seedActionItems(page, [{ memberIndex: 0, title: 'Send the career ladder' }]);
  await seedSkills(page, [{ memberIndex: 0, name: SKILL_NAME, level: 'expert' }]);
  await seedFeedback(page, [
    { memberIndex: 1, date: '2025-02-10', type: 'positive', text: FEEDBACK_TEXT },
  ]);
};

const read = async (download: Download) => readFileSync((await download.path()) as string, 'utf8');

/** Runs the export dialog and returns the downloaded file. */
const exportBackup = async (page: Page, passphrase = TEST_PASSPHRASE) => {
  const section = await openSettings(page);
  await section.getByRole('button', { name: 'Export Data' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export Data' });
  await dialog.getByLabel(/^Passphrase/).fill(passphrase);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Export backup' }).click(),
  ]);
  return { download, content: await read(download) };
};

const chooseBackup = (page: Page, content: string, name = 'crewbook-backup.json.enc') =>
  page
    .getByLabel('Select backup file to import')
    .setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(content) });

/** Simulates a new browser: no stored data at all, then first-launch setup. */
const wipeAndSetUp = async (page: Page, passphrase: string) => {
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await setUpPassphrase(page, passphrase);
};

test.describe('full data export and backup', () => {
  test('backs up everything, then restores it on a fresh browser with a different passphrase', async ({
    unlockedApp: page,
  }) => {
    await seedEverything(page);
    const section = await openSettings(page);
    await expect(section.getByText('Last backup: Never')).toBeVisible();

    await section.getByRole('button', { name: 'Export Data' }).click();
    const dialog = page.getByRole('dialog', { name: 'Export Data' });
    await expect(dialog.getByText(/includes your private data/)).toBeVisible();
    await expect(dialog.getByText('1 note', { exact: true })).toBeVisible();
    await expect(dialog.getByText('1 skill', { exact: true })).toBeVisible();
    await expect(dialog.getByText(/cloud/)).toBeVisible();
    await expectNoViolations(page);

    await dialog.getByLabel(/^Passphrase/).fill('not the right one');
    await dialog.getByRole('button', { name: 'Export backup' }).click();
    await expect(dialog.getByText(/isn't the passphrase you unlock Crewbook with/)).toBeVisible();

    await dialog.getByLabel(/^Passphrase/).fill(TEST_PASSPHRASE);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'Export backup' }).click(),
    ]);
    const content = await read(download);

    expect(download.suggestedFilename()).toMatch(/^crewbook-backup-\d{4}-\d{2}-\d{2}\.json\.enc$/);
    await expect(page.getByText(/^Backup saved as crewbook-backup-/)).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(section.getByText(/^Last backup: (?!Never)/)).toBeVisible();
    for (const secret of ['Alice Park', PRIVATE_NOTE, FEEDBACK_TEXT, SKILL_NAME]) {
      expect(content).not.toContain(secret);
    }

    await wipeAndSetUp(page, NEW_DEVICE_PASSPHRASE);
    await openRoster(page);
    await expect(page.getByTestId('member-row')).toHaveCount(0);

    const fresh = await openSettings(page);
    await chooseBackup(page, content);
    const passphraseDialog = page.getByRole('dialog', { name: 'Backup passphrase' });
    await passphraseDialog.getByLabel(/^Passphrase/).fill('wrong passphrase');
    await passphraseDialog.getByRole('button', { name: 'Open backup' }).click();
    await expect(passphraseDialog.getByText(/didn't open this backup/)).toBeVisible();

    await passphraseDialog.getByLabel(/^Passphrase/).fill(TEST_PASSPHRASE);
    await passphraseDialog.getByRole('button', { name: 'Open backup' }).click();
    const preview = page.getByRole('alertdialog', { name: 'Import Backup' });
    await expect(preview.getByText('4 team members')).toBeVisible();
    await expect(preview.getByText('2 notes')).toBeVisible();
    await expect(preview.getByText('It includes private data.')).toBeVisible();
    await expect(
      preview.getByText('Importing will replace all current data. This cannot be undone.'),
    ).toBeVisible();
    await expectNoViolations(page);
    await preview.getByRole('button', { name: 'Replace All Data' }).click();

    await expect(page.getByText('Data imported successfully')).toBeVisible();
    await expect(fresh).toBeVisible();

    await openRoster(page);
    await expect(page.getByTestId('member-row')).toHaveCount(4);
    for (const member of SEED_TEAM) await expect(page.getByText(member.name).first()).toBeVisible();

    await page.reload();
    await unlock(page, NEW_DEVICE_PASSPHRASE);
    await openRoster(page);
    await expect(page.getByTestId('member-row')).toHaveCount(4);
    await page.getByTestId('member-row').filter({ hasText: 'Alice Park' }).click();
    await page.getByRole('tab', { name: 'Notes' }).click();
    await expect(
      page.getByRole('list', { name: '1:1 notes history' }).getByText(PRIVATE_NOTE),
    ).toBeVisible();
  });

  test('downloads a roster CSV without any private data after a warning', async ({
    unlockedApp: page,
  }) => {
    await seedEverything(page);
    const section = await openSettings(page);

    await section.getByRole('button', { name: 'Download CSV (Unencrypted)' }).click();
    const warning = page.getByRole('alertdialog', { name: 'Download unencrypted CSV?' });
    await expect(warning.getByText(/not encrypted/)).toBeVisible();
    await expectNoViolations(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      warning.getByRole('button', { name: 'Download CSV' }).click(),
    ]);
    const csv = (await read(download)).replace(/^\uFEFF/, '');

    expect(download.suggestedFilename()).toMatch(/^crewbook-roster-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.split('\r\n')[0]).toBe('name,role,level,email,status');
    expect(csv).toContain('Alice Park,Staff Engineer,L6,seed-0@example.com,active');
    for (const secret of [PRIVATE_NOTE, FEEDBACK_TEXT, SKILL_NAME, 'career ladder']) {
      expect(csv).not.toContain(secret);
    }
    await expect(
      page.getByText(/Remember to delete the export file when you're done/),
    ).toBeVisible();
  });

  test('does not download anything when the CSV warning is cancelled', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM);
    const section = await openSettings(page);
    let downloads = 0;
    page.on('download', () => {
      downloads += 1;
    });

    await section.getByRole('button', { name: 'Download CSV (Unencrypted)' }).click();
    await page
      .getByRole('alertdialog', { name: 'Download unencrypted CSV?' })
      .getByRole('button', { name: 'Cancel' })
      .click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    expect(downloads).toBe(0);
  });

  test('shows a busy state while the backup is being encrypted', async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM);
    const section = await openSettings(page);
    await page.evaluate(() => {
      const original = crypto.subtle.deriveKey.bind(crypto.subtle);
      crypto.subtle.deriveKey = async (...args: Parameters<SubtleCrypto['deriveKey']>) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return original(...args);
      };
    });
    await section.getByRole('button', { name: 'Export Data' }).click();
    const dialog = page.getByRole('dialog', { name: 'Export Data' });
    await dialog.getByLabel(/^Passphrase/).fill(TEST_PASSPHRASE);

    const downloading = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export backup' }).click();

    const busy = dialog.getByRole('button', { name: 'Exporting data, please wait' });
    await expect(busy).toBeVisible();
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    await expect(busy).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await downloading;
    await expect(dialog).toHaveCount(0);
  });
});

test.describe('restoring a backup', () => {
  test('refuses files that are not Crewbook backups and changes nothing', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM);
    const section = await openSettings(page);

    await chooseBackup(page, 'hello, this is not a backup');
    const invalid = page.getByRole('dialog', { name: 'Import Backup' });
    await expect(invalid.getByRole('alert')).toHaveText(
      'This file is not a valid Crewbook backup.',
    );
    await expect(invalid.getByRole('button', { name: 'Replace All Data' })).toHaveCount(0);
    await expectNoViolations(page);
    await invalid.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(invalid).toHaveCount(0);
    await expect(section.getByRole('button', { name: 'Import Data' })).toBeFocused();

    await chooseBackup(page, '{}', 'notes.json');
    await expect(page.getByRole('alert')).toHaveText('This file is not a valid Crewbook backup.');
    await page.keyboard.press('Escape');

    await openRoster(page);
    await expect(page.getByTestId('member-row')).toHaveCount(4);
  });

  test('refuses an encrypted file whose contents have been changed', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM);
    const { content } = await exportBackup(page);
    const file = JSON.parse(content) as { ct: string };
    const flipped = file.ct.startsWith('A') ? `B${file.ct.slice(1)}` : `A${file.ct.slice(1)}`;

    await chooseBackup(page, JSON.stringify({ ...file, ct: flipped }));
    const passphraseDialog = page.getByRole('dialog', { name: 'Backup passphrase' });
    await passphraseDialog.getByLabel(/^Passphrase/).fill(TEST_PASSPHRASE);
    await passphraseDialog.getByRole('button', { name: 'Open backup' }).click();

    await expect(
      passphraseDialog.getByText(/didn't open this backup, or the file is damaged/),
    ).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('keeps the current data when the import is cancelled with Escape', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM);
    const { content } = await exportBackup(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const section = await openSettings(page);

    await chooseBackup(page, content);
    const passphraseDialog = page.getByRole('dialog', { name: 'Backup passphrase' });
    await passphraseDialog.getByLabel(/^Passphrase/).fill(TEST_PASSPHRASE);
    await passphraseDialog.getByRole('button', { name: 'Open backup' }).click();
    const preview = page.getByRole('alertdialog', { name: 'Import Backup' });
    await expect(preview.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Escape');

    await expect(preview).toHaveCount(0);
    await expect(section.getByRole('button', { name: 'Import Data' })).toBeFocused();
    await openRoster(page);
    await expect(page.getByTestId('member-row')).toHaveCount(4);
  });
});
