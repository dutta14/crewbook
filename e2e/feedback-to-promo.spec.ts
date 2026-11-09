import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedFeedback, seedId, seedMembers } from './fixtures/seedMembers';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const today = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

interface NewFeedback {
  person?: string;
  type?: string;
  text: string;
  tags?: string[];
}

const logFeedback = async (page: Page, { person, type, text, tags = [] }: NewFeedback) => {
  const dialog = page.getByRole('dialog', { name: 'Log feedback' });
  await expect(dialog).toBeVisible();
  if (person) {
    await dialog.getByRole('combobox', { name: /Person/ }).selectOption({ label: person });
  }
  if (type) await dialog.getByRole('radio', { name: type }).check({ force: true });
  await dialog.getByRole('textbox', { name: /What did you observe/ }).fill(text);
  for (const tag of tags) {
    await dialog.getByRole('textbox', { name: 'Add tags' }).fill(tag);
    await dialog.getByRole('textbox', { name: 'Add tags' }).press('Enter');
  }
  await dialog.getByRole('button', { name: 'Save feedback' }).click();
  await expect(dialog).toHaveCount(0);
};

const openFeedbackPage = async (page: Page) => {
  await page.evaluate(() => window.location.assign('#/feedback'));
  await expect(page.getByRole('heading', { level: 1, name: 'Feedback' })).toBeVisible();
  return page.getByRole('list', { name: 'Feedback entries' });
};

const openProfileFeedback = async (page: Page, memberIndex: number) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('tab', { name: /^Feedback/ }).click();
  return page.getByRole('tabpanel', { name: /^Feedback/ });
};

test.describe('feedback log', () => {
  test.beforeEach(async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
  });

  test('feedback can be logged from the dashboard, the roster and a profile', async ({
    unlockedApp: page,
  }) => {
    await page.getByRole('button', { name: 'Log feedback', exact: true }).click();
    await expectNoViolations(page);
    await logFeedback(page, {
      person: 'Alice Park',
      type: 'Positive',
      text: 'Ran the launch review calmly',
      tags: ['leadership'],
    });
    await expect(page.getByText('Feedback logged')).toBeVisible();

    await page.evaluate(() => window.location.assign('#/roster'));
    await page.getByRole('button', { name: 'Log feedback for Bob Singh' }).first().click();
    await expect(
      page.getByRole('dialog', { name: 'Log feedback' }).getByRole('combobox', { name: /Person/ }),
    ).toHaveValue(seedId(1));
    await logFeedback(page, { type: 'Constructive', text: 'Went quiet in planning' });

    await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(0));
    await page.getByRole('button', { name: 'Log feedback for Alice Park' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Log feedback' }).getByRole('combobox', { name: /Person/ }),
    ).toHaveValue(seedId(0));
    await logFeedback(page, { text: 'Asked about the roadmap' });

    const list = await openFeedbackPage(page);
    await expect(list.locator('.feedback-card__text')).toHaveCount(3);
    await expect(list).toContainText('Ran the launch review calmly');
    await expect(list).toContainText('Went quiet in planning');
    await expect(list).toContainText('Asked about the roadmap');
  });

  test('a profile shows its own entries and a count on the tab', async ({ unlockedApp: page }) => {
    await seedFeedback(page, [
      { memberIndex: 0, date: '2025-03-10', type: 'positive', text: 'Great demo', tags: ['demo'] },
      { memberIndex: 0, date: '2025-04-02', type: 'neutral', text: 'Asked about the roadmap' },
      { memberIndex: 1, date: '2025-02-01', type: 'constructive', text: 'Went quiet in planning' },
    ]);

    const panel = await openProfileFeedback(page, 0);

    await expect(page.getByRole('tab', { name: 'Feedback 2 entries' })).toBeVisible();
    await expect(panel.locator('.feedback-card__text')).toHaveText([
      'Asked about the roadmap',
      'Great demo',
    ]);
    await expect(panel).not.toContainText('Went quiet in planning');
    await expectNoViolations(page);
  });

  test('entries can be searched and filtered, and edited or deleted', async ({
    unlockedApp: page,
  }) => {
    await seedFeedback(page, [
      { memberIndex: 0, date: '2025-03-10', type: 'positive', text: 'Great demo', tags: ['demo'] },
      { memberIndex: 1, date: '2025-02-01', type: 'constructive', text: 'Went quiet in planning' },
      { memberIndex: 0, date: '2025-04-02', type: 'neutral', text: 'Asked about the roadmap' },
    ]);
    const list = await openFeedbackPage(page);
    const texts = list.locator('.feedback-card__text');
    await expectNoViolations(page);

    await page.getByRole('searchbox', { name: 'Search feedback' }).fill('quiet');
    await expect(texts).toHaveText(['Went quiet in planning']);
    await expect(page.getByText('1 feedback entry shown')).toBeAttached();

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByRole('combobox', { name: 'Person' }).selectOption({ label: 'Alice Park' });
    await page.getByRole('combobox', { name: 'Type' }).selectOption('positive');
    await expect(texts).toHaveText(['Great demo']);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByRole('combobox', { name: 'Tag' }).selectOption('demo');
    await expect(texts).toHaveText(['Great demo']);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByLabel('From', { exact: true }).fill('2025-03-01');
    await page.getByLabel('To', { exact: true }).fill('2025-03-31');
    await expect(texts).toHaveText(['Great demo']);

    await page.getByRole('searchbox', { name: 'Search feedback' }).fill('nothing like this');
    await expect(page.getByRole('heading', { name: 'No matching feedback' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).last().click();
    await expect(texts).toHaveCount(3);

    await page.getByRole('button', { name: /^Edit positive feedback for Alice Park/ }).click();
    await page
      .getByRole('textbox', { name: /What did you observe/ })
      .fill('Great demo to the exec team');
    await page.getByRole('button', { name: 'Save feedback' }).click();
    await expect(texts.filter({ hasText: 'exec team' })).toHaveCount(1);

    const deleteBob = page.getByRole('button', {
      name: /^Delete constructive feedback for Bob Singh/,
    });
    await deleteBob.click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(texts).toHaveCount(3);
    await deleteBob.click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(texts).toHaveCount(2);
    await expect(page.getByRole('heading', { level: 1, name: 'Feedback' })).toBeFocused();
  });

  test('the promo packet holds only positive feedback and can be copied', async ({
    unlockedApp: page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await seedFeedback(page, [
      { memberIndex: 0, date: '2025-03-10', type: 'positive', text: 'Great demo', tags: ['demo'] },
      { memberIndex: 0, date: '2025-02-01', type: 'positive', text: 'Mentored an intern' },
      { memberIndex: 0, date: '2025-02-15', type: 'constructive', text: 'Missed a handoff' },
      { memberIndex: 1, date: '2025-02-20', type: 'positive', text: 'Another person entirely' },
    ]);
    await openFeedbackPage(page);

    await page.getByRole('button', { name: 'Promo packet mode' }).click();
    const panel = page.getByRole('region', { name: 'Promo packet mode' });
    await expect(panel.getByText('Positive only')).toBeVisible();
    await panel.getByRole('combobox', { name: 'Person' }).selectOption({ label: 'Alice Park' });
    await panel.getByLabel('From', { exact: true }).fill('2025-01-01');
    await panel.getByLabel('To', { exact: true }).fill(today());

    const output = panel.getByRole('region', { name: 'Promo packet text' });
    await expect(output).toContainText('Promo packet: Alice Park');
    await expect(output).toContainText('Mentored an intern');
    await expect(output).toContainText('Great demo');
    await expect(output).toContainText('Tags: demo');
    await expect(output).not.toContainText('Missed a handoff');
    await expect(output).not.toContainText('Another person entirely');
    await expectNoViolations(page);

    await panel.getByRole('button', { name: 'Copy promo packet to clipboard' }).click();
    await expect(page.getByText('Copied to clipboard').first()).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('Promo packet: Alice Park');
    expect(copied.indexOf('Mentored an intern')).toBeLessThan(copied.indexOf('Great demo'));
    expect(copied).not.toContain('Missed a handoff');
  });

  test('entries survive a reload and are removed with the person', async ({
    unlockedApp: page,
  }) => {
    await seedFeedback(page, [
      { memberIndex: 0, date: '2025-03-10', type: 'positive', text: 'Great demo' },
      { memberIndex: 1, date: '2025-02-01', type: 'neutral', text: 'Asked about benefits' },
    ]);
    await openFeedbackPage(page);
    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    const list = await openFeedbackPage(page);
    await expect(list.locator('.feedback-card__text')).toHaveCount(2);

    await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(0));
    await page.getByRole('button', { name: 'Delete Alice Park' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();

    const remaining = await openFeedbackPage(page);
    await expect(remaining.locator('.feedback-card__text')).toHaveText(['Asked about benefits']);
    await expect(page.getByText('Great demo')).toHaveCount(0);
  });

  test('an empty log invites the first observation', async ({ unlockedApp: page }) => {
    await page.evaluate(() => window.location.assign('#/feedback'));

    await expect(page.getByRole('heading', { name: 'No feedback logged yet' })).toBeVisible();
    await expect(page.getByText(/Only you can see feedback/)).toBeVisible();
    await expectNoViolations(page);

    await page.getByRole('button', { name: 'Log your first observation' }).click();
    await logFeedback(page, { person: 'Bob Singh', text: 'First note' });
    await expect(page.getByRole('list', { name: 'Feedback entries' })).toContainText('First note');
  });
});
