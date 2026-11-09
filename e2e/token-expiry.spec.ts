import AxeBuilder from '@axe-core/playwright';
import type { Browser, Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedId, seedMembers, seedNotes } from './fixtures/seedMembers';

const MANAGER = 'Morgan Lee';
const HOUR_MS = 60 * 60 * 1000;

async function openDialog(page: Page, memberIndex = 0) {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await page.getByRole('button', { name: 'Share 1:1' }).click();
  const dialog = page.getByRole('dialog', { name: /^Share 1:1 with / });
  const name = dialog.getByRole('textbox', { name: 'Your name' });
  if ((await name.inputValue()) === '') await name.fill(MANAGER);
  return dialog;
}

/** Reads the link from the dialog's input, so the test never depends on the clipboard. */
async function createLink(page: Page, expiry?: string) {
  const dialog = await openDialog(page);
  if (expiry) await dialog.getByRole('combobox', { name: 'Expires in' }).selectOption(expiry);
  await dialog.getByRole('button', { name: /^Create (new )?link$/ }).click();
  await dialog.getByRole('button', { name: 'I understand' }).click();
  const link = await dialog.getByRole('textbox', { name: 'Share link' }).inputValue();
  expect(link).toContain('#/shared/');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  return link;
}

async function openAsRecipient(browser: Browser, link: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  return { page, close: () => context.close() };
}

const tokenTable = (page: Page) => page.getByRole('table', { name: 'Active share links' });

test.describe('token-based access with expiry', () => {
  test('the expiry choice defaults to 24 hours and sets how long the link lasts', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    await seedNotes(page, [
      { memberIndex: 0, content: 'Talked about the launch', hoursAgo: 2, visibility: 'shared' },
    ]);
    const dialog = await openDialog(page);
    await expect(dialog.getByRole('combobox', { name: 'Expires in' })).toHaveValue('24h');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();

    const day = await createLink(page);
    const hour = await createLink(page, '1h');

    expect(hour).not.toBe(day);
    const dayView = await openAsRecipient(browser, day);
    await expect(dayView.page.getByText('Expires in 24 hours')).toBeVisible();
    await dayView.close();
    const hourView = await openAsRecipient(browser, hour);
    await expect(hourView.page.getByText('Expires in 1 hour')).toBeVisible();
    await expect(hourView.page.getByText('Talked about the launch')).toBeVisible();
    await hourView.page.evaluate(() =>
      Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
    );
    const { violations } = await new AxeBuilder({ page: hourView.page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(violations).toEqual([]);
    await hourView.close();
  });

  test('a link past its expiry shows a page that asks for a new link and nothing else', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    const link = await createLink(page);

    const recipient = await openAsRecipient(browser, link);
    await recipient.page.clock.install({ time: Date.now() + 25 * HOUR_MS });
    await recipient.page.reload();

    await expect(
      recipient.page.getByRole('heading', { level: 1, name: 'This link has expired' }),
    ).toBeVisible();
    await expect(
      recipient.page.getByText('Ask your manager to generate a new share link.'),
    ).toBeVisible();
    await expect(recipient.page.getByText(MANAGER)).toHaveCount(0);
    await expect(recipient.page.getByText('Alice Park')).toHaveCount(0);
    await recipient.close();
  });

  test('a link that runs out while it is open is replaced by the expired page', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    const link = await createLink(page, '1h');

    const context = await browser.newContext();
    const view = await context.newPage();
    await view.clock.install();
    await view.goto(link);
    await expect(
      view.getByRole('heading', { level: 1, name: `1:1 with ${MANAGER}` }),
    ).toBeVisible();

    await view.clock.fastForward(HOUR_MS + 2 * 60 * 1000);

    await expect(
      view.getByRole('heading', { level: 1, name: 'This link has expired' }),
    ).toBeVisible();
    await expect(view.getByText('Alice Park')).toHaveCount(0);
    await context.close();
  });

  test('the person’s page lists active links with a countdown and flags one close to expiry', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(0));
    await expect(page.getByText('No active share links.')).toBeVisible();

    await createLink(page);
    await createLink(page, '1h');

    const rows = tokenTable(page).getByRole('row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText('Expires in 1 hour');
    await expect(rows.nth(2)).toContainText('Expires in 24 hours');
    await expect(tokenTable(page).getByRole('columnheader')).toHaveCount(3);
  });

  test('revoking a link in the manager’s browser turns it into the expired page, and stays revoked after a reload', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    const link = await createLink(page);
    await expect(tokenTable(page).getByRole('row')).toHaveCount(2);

    await tokenTable(page)
      .getByRole('button', { name: /^Revoke share link / })
      .click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText(
      'This will immediately revoke access for anyone with this link.',
    );
    await confirm.getByRole('button', { name: 'Revoke link' }).click();

    await expect(page.getByText('No active share links.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Active share links' })).toBeFocused();

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await expect(page.getByText('No active share links.')).toBeVisible();
    await page.evaluate((next) => window.location.assign(next), new URL(link).hash);
    await expect(
      page.getByRole('heading', { level: 1, name: 'This link has expired' }),
    ).toBeVisible();
    await expect(page.getByText('Alice Park')).toHaveCount(0);
  });

  test('the QR code stays hidden until asked and carries the whole link', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    const dialog = await openDialog(page);
    await dialog.getByRole('button', { name: /^Create (new )?link$/ }).click();
    await dialog.getByRole('button', { name: 'I understand' }).click();
    const link = await dialog.getByRole('textbox', { name: 'Share link' }).inputValue();
    await expect(dialog.getByRole('img')).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Show QR code' }).click();

    await expect(dialog.getByRole('img', { name: `QR code linking to ${link}` })).toBeVisible();
    await expect(dialog).toContainText('This QR code contains your 1:1 data');
    await dialog.getByRole('button', { name: 'Hide QR code' }).click();
    await expect(dialog.getByRole('img')).toHaveCount(0);
  });
});
