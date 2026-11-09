import AxeBuilder from '@axe-core/playwright';
import type { Browser, Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';
import {
  SEED_TEAM,
  seedActionItems,
  seedAgenda,
  seedId,
  seedMembers,
  seedMoods,
  seedNotes,
} from './fixtures/seedMembers';

const MANAGER = 'Morgan Lee';
const PRIVATE_NOTE = 'PRIVATE-NOTE-SENTINEL';
const UNMARKED_NOTE = 'UNMARKED-NOTE-SENTINEL';
const OTHER_PERSON_NOTE = 'OTHER-PERSON-SENTINEL';
const PRIVATE_AGENDA = 'PRIVATE-AGENDA-SENTINEL';

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

/** The recipient has no passphrase and no stored data: a fresh browser context. */
async function openAsRecipient(browser: Browser, link: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  return { page, close: () => context.close() };
}

test.describe('shareable 1:1 view', () => {
  test('a manager creates a link that opens for the engineer without a passphrase', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await seedNotes(page, [
      { memberIndex: 0, content: 'Talked about the launch', hoursAgo: 2, visibility: 'shared' },
    ]);

    const link = await createLink(page);
    const recipient = await openAsRecipient(browser, link);

    await expect(
      recipient.page.getByRole('heading', { level: 1, name: `1:1 with ${MANAGER}` }),
    ).toBeVisible();
    await expect(recipient.page.getByRole('img', { name: 'Alice Park' })).toBeVisible();
    await expect(recipient.page.getByText('Talked about the launch')).toBeVisible();
    await expect(recipient.page.getByLabel('Passphrase')).toHaveCount(0);
    await expectNoViolations(recipient.page);
    await recipient.close();
  });

  test('the shared page holds only what was marked for sharing', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await seedNotes(page, [
      { memberIndex: 0, content: 'Shared note body', hoursAgo: 3, visibility: 'shared' },
      { memberIndex: 0, content: PRIVATE_NOTE, hoursAgo: 4, visibility: 'private' },
      { memberIndex: 0, content: UNMARKED_NOTE, hoursAgo: 5 },
      { memberIndex: 1, content: OTHER_PERSON_NOTE, hoursAgo: 6, visibility: 'shared' },
    ]);
    await seedMoods(page, [{ memberIndex: 0, score: 1, daysAgo: 1 }]);
    await seedAgenda(page, [
      { memberIndex: 0, text: 'Promo timeline', addedBy: 'engineer', includeInShare: true },
      { memberIndex: 0, text: PRIVATE_AGENDA, addedBy: 'manager' },
    ]);

    const link = await createLink(page);
    const recipient = await openAsRecipient(browser, link);
    const view = recipient.page;

    await expect(view.getByText('Shared note body')).toBeVisible();
    await expect(view.getByText('Promo timeline')).toBeVisible();
    const text = (await view.locator('body').innerText()).toLowerCase();
    for (const hidden of [PRIVATE_NOTE, UNMARKED_NOTE, OTHER_PERSON_NOTE, PRIVATE_AGENDA]) {
      expect(text).not.toContain(hidden.toLowerCase());
    }
    for (const word of ['mood', 'flight risk', 'bob singh', 'growth', 'feedback']) {
      expect(text).not.toContain(word);
    }
    expect(link).not.toContain(PRIVATE_NOTE);
    await recipient.close();
  });

  test('action items show who owns them and flag the overdue ones', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    await seedActionItems(page, [
      { memberIndex: 0, title: 'Send the design doc', dueInDays: -3 },
      { memberIndex: 0, title: 'Book the offsite', dueInDays: 10 },
      { memberIndex: 0, title: 'Already finished', dueInDays: -9, status: 'done' },
    ]);

    const recipient = await openAsRecipient(browser, await createLink(page));
    const items = recipient.page.getByRole('list', { name: 'Action items' });

    await expect(items.getByRole('listitem')).toHaveCount(2);
    const overdue = items.getByRole('listitem').filter({ hasText: 'Send the design doc' });
    await expect(overdue).toContainText('(overdue)');
    await expect(overdue).toContainText(MANAGER);
    await expect(
      items.getByRole('listitem').filter({ hasText: 'Book the offsite' }),
    ).not.toContainText('(overdue)');
    await recipient.page.getByRole('button', { name: 'Done (1)' }).click();
    const done = recipient.page.getByRole('list', { name: 'Done action items' });
    await expect(done.getByRole('listitem')).not.toContainText('(overdue)');
    await expect(
      done.getByRole('checkbox', { name: 'Mark Already finished as done' }),
    ).toBeChecked();
    await recipient.close();
  });

  test('sections without content show an empty state and nothing to act on', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));

    const recipient = await openAsRecipient(browser, await createLink(page));

    await expect(recipient.page.getByText('No shared notes yet.')).toBeVisible();
    await expect(recipient.page.getByText('No action items yet')).toBeVisible();
    await expect(recipient.page.getByText('No agenda items yet.')).toBeVisible();
    await expect(recipient.page.getByRole('button')).toHaveCount(0);
    await recipient.close();
  });

  test('the shared page is a clean single column without navigation or other people', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM);

    const recipient = await openAsRecipient(browser, await createLink(page));
    const view = recipient.page;

    await expect(view.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(view.getByRole('navigation')).toHaveCount(0);
    await expect(view.getByRole('link', { name: 'Skip to agenda' })).toHaveCount(1);
    for (const name of ['Bob Singh', 'Carmen Diaz', 'Dev Patel']) {
      await expect(view.getByText(name)).toHaveCount(0);
    }
    await view.setViewportSize({ width: 375, height: 700 });
    const overflows = await view.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
    await recipient.close();
  });

  test('an invalid or tampered link shows a plain error and no data', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    const link = await createLink(page);
    const token = link.slice(link.indexOf('#/shared/') + '#/shared/'.length);
    const flip = (value: string, at: number) =>
      `${value.slice(0, at)}${value[at] === 'A' ? 'B' : 'A'}${value.slice(at + 1)}`;
    const corruptedBody = link.replace(token, flip(token, 10));

    for (const bad of [corruptedBody, link.replace(token, 'not-a-token')]) {
      const recipient = await openAsRecipient(browser, bad);
      await expect(
        recipient.page.getByRole('heading', { level: 1, name: /^This link is invalid/ }),
      ).toBeVisible();
      await expect(recipient.page.getByText('Alice Park')).toHaveCount(0);
      await expect(recipient.page.getByRole('navigation')).toHaveCount(0);
      await expectNoViolations(recipient.page);
      await recipient.close();
    }
  });

  test('the manager’s own unlocked session rejects a link whose signature was altered', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    const link = await createLink(page);
    const hash = new URL(link).hash;
    const altered = `${hash.slice(0, -2)}${hash.endsWith('A') ? 'BB' : 'AA'}`;

    await page.evaluate((next) => window.location.assign(next), altered);

    await expect(
      page.getByRole('heading', { level: 1, name: /^This link is invalid/ }),
    ).toBeVisible();
    await expect(page.getByText('Alice Park')).toHaveCount(0);
  });

  test('a link whose lifetime has passed shows the expired page', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    const link = await createLink(page);
    const recipient = await openAsRecipient(browser, link);
    await expect(recipient.page.getByRole('heading', { level: 1 })).toContainText('1:1 with');

    await recipient.page.clock.install({ time: Date.now() + 25 * 60 * 60 * 1000 });
    await recipient.page.reload();

    await expect(
      recipient.page.getByRole('heading', { level: 1, name: 'This link has expired' }),
    ).toBeVisible();
    await expect(recipient.page.getByText('Alice Park')).toHaveCount(0);
    await recipient.close();
  });
});
