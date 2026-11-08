import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedDecisions, seedId, seedMembers } from './fixtures/seedMembers';

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

const openDecisionsTab = async (page: Page) => {
  await page.getByRole('tab', { name: 'Decisions & Follow-ups' }).click();
  return page.getByRole('tabpanel', { name: 'Decisions & Follow-ups' });
};

const openGlobalPage = async (page: Page) => {
  await page.getByRole('link', { name: 'Decisions & Follow-ups' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Decisions & Follow-ups' }),
  ).toBeVisible();
};

const articles = (page: Page) =>
  page.getByRole('list', { name: 'Decisions and follow-ups' }).getByRole('article');

test.describe('decisions and follow-ups', () => {
  test.beforeEach(async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
  });

  test('a decision captured in live mode shows on the profile and the global page, linked to the 1:1', async ({
    unlockedApp: page,
  }) => {
    await openProfile(page);
    const dialog = await startLive(page);
    await dialog.getByRole('button', { name: 'Add decision' }).click();
    await dialog.getByRole('textbox', { name: 'Decision title' }).fill('Move to weekly releases');
    await dialog.getByRole('textbox', { name: 'Decision context' }).fill('Fewer big-bang deploys');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog.getByRole('textbox', { name: '1:1 notes' })).toBeFocused();
    await endLive(page);

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    const panel = await openDecisionsTab(page);
    const card = panel.getByRole('article', { name: 'Decision: Move to weekly releases' });
    await expect(card).toContainText('Fewer big-bang deploys');
    await expect(card.getByRole('link', { name: /^View 1:1 notes from / })).toBeVisible();
    await expectNoViolations(page);

    await card.getByRole('link', { name: /^View 1:1 notes from / }).click();
    await expect(page.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true');
    await expect(page).not.toHaveURL(/note=/);

    await openGlobalPage(page);
    await expect(
      articles(page).filter({ hasText: 'Move to weekly releases' }).getByRole('link', {
        name: 'Alice Park',
      }),
    ).toBeVisible();
  });

  test('a follow-up captured with an owner and due date can be marked done and pending again', async ({
    unlockedApp: page,
  }) => {
    await openProfile(page);
    const dialog = await startLive(page);
    await dialog.getByRole('button', { name: 'Add follow-up' }).click();
    await dialog.getByRole('textbox', { name: 'Follow-up title' }).fill('Send the design doc');
    await dialog.getByRole('combobox', { name: 'Owner' }).selectOption({ label: 'Alice Park' });
    await dialog.getByLabel('Due date').fill('2099-03-14');
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Follow-up added')).toBeVisible();
    await endLive(page);

    const panel = await openDecisionsTab(page);
    const card = panel.getByRole('article', { name: 'Follow-up: Send the design doc' });
    await expect(card).toContainText('Alice Park');
    await expect(card).toContainText('Due Mar 14, 2099');

    await card.getByRole('button', { name: 'Mark as done' }).click();
    await expect(card.getByRole('button', { name: 'Mark as pending' })).toContainText('Done');
    await expect(card.getByRole('status')).toHaveText('Follow-up marked as done');

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    const again = (await openDecisionsTab(page)).getByRole('article', {
      name: 'Follow-up: Send the design doc',
    });
    await expect(again.getByRole('button', { name: 'Mark as pending' })).toBeVisible();
    await again.getByRole('button', { name: 'Mark as pending' }).click();
    await expect(again.getByRole('button', { name: 'Mark as done' })).toContainText('Pending');
  });

  test('the type filter narrows the list to decisions or follow-ups', async ({
    unlockedApp: page,
  }) => {
    await seedDecisions(page, {
      decisions: [
        { memberIndex: 0, title: 'Decision one' },
        { memberIndex: 0, title: 'Decision two' },
      ],
      followUps: [
        { memberIndex: 0, title: 'Follow-up one', dueInDays: 5 },
        { memberIndex: 0, title: 'Follow-up two', dueInDays: 6 },
        { memberIndex: 0, title: 'Follow-up three' },
      ],
    });
    await openProfile(page);
    await openDecisionsTab(page);
    await expect(articles(page)).toHaveCount(5);

    await page.getByRole('radio', { name: 'Decisions' }).click();
    await expect(articles(page)).toHaveCount(2);
    await expect(articles(page).first()).toHaveAccessibleName(/^Decision: /);

    await page.getByRole('radio', { name: 'Follow-ups' }).click();
    await expect(articles(page)).toHaveCount(3);
    await expect(articles(page).first()).toHaveAccessibleName(/^Follow-up: /);

    await page.getByRole('radio', { name: 'All' }).click();
    await expect(articles(page)).toHaveCount(5);
    await expectNoViolations(page);
  });

  test('the global page filters by person', async ({ unlockedApp: page }) => {
    await seedDecisions(page, {
      decisions: [
        { memberIndex: 0, title: 'Alice decision' },
        { memberIndex: 1, title: 'Bob decision' },
      ],
      followUps: [{ memberIndex: 1, title: 'Bob follow-up' }],
    });
    await openGlobalPage(page);
    await expect(articles(page)).toHaveCount(3);

    await page.getByRole('combobox', { name: 'Person' }).selectOption({ label: 'Bob Singh' });
    await expect(articles(page)).toHaveCount(2);
    await expect(articles(page).filter({ hasText: 'Alice decision' })).toHaveCount(0);
    await expect(page).not.toHaveURL(/person|bob/i);

    await page
      .getByRole('combobox', { name: 'Person' })
      .selectOption({ label: 'All team members' });
    await expect(articles(page)).toHaveCount(3);
    await expectNoViolations(page);
  });

  test('a pending follow-up past its due date is marked overdue, and a done one is not', async ({
    unlockedApp: page,
  }) => {
    await seedDecisions(page, {
      followUps: [
        { memberIndex: 0, title: 'Late follow-up', dueInDays: -3 },
        { memberIndex: 0, title: 'Finished follow-up', dueInDays: -3, status: 'done' },
        { memberIndex: 0, title: 'Future follow-up', dueInDays: 4 },
      ],
    });
    await openProfile(page);
    const panel = await openDecisionsTab(page);

    await expect(
      panel.getByRole('article', { name: 'Follow-up: Late follow-up' }).getByText('(overdue)'),
    ).toBeAttached();
    await expect(panel.getByText('(overdue)')).toHaveCount(1);
    await expectNoViolations(page);
  });

  test('deleting a person removes their decisions and follow-ups', async ({
    unlockedApp: page,
  }) => {
    await seedDecisions(page, {
      decisions: [
        { memberIndex: 0, title: 'Alice decision' },
        { memberIndex: 1, title: 'Bob decision' },
      ],
    });
    await openProfile(page, 0);
    await page.getByRole('button', { name: 'Delete Alice Park' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();

    await openGlobalPage(page);
    await expect(articles(page)).toHaveCount(1);
    await expect(articles(page).first()).toContainText('Bob decision');
  });
});
