import AxeBuilder from '@axe-core/playwright';
import type { Browser, Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedAgenda, seedId, seedMembers, seedNotes } from './fixtures/seedMembers';

const MANAGER = 'Morgan Lee';
const SHARED_TOPIC = 'Promotion timeline';
const HELD_BACK_TOPIC = 'HELD-BACK-TOPIC-SENTINEL';

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

const agendaCard = (page: Page) => page.getByRole('region', { name: "Engineer's Agenda" });
const agendaList = (page: Page) => agendaCard(page).getByRole('list', { name: 'Agenda items' });

async function addAgendaItem(page: Page, text: string, addedBy?: string) {
  const card = agendaCard(page);
  if (addedBy) await card.getByLabel('Added by', { exact: true }).selectOption({ label: addedBy });
  await card.getByRole('textbox', { name: 'Add an agenda item' }).fill(text);
  await card.getByRole('button', { name: 'Add agenda item' }).click();
  await expect(card.getByRole('list', { name: 'Agenda items' })).toContainText(text);
}

async function createLink(page: Page) {
  await page.getByRole('button', { name: 'Share 1:1' }).click();
  const dialog = page.getByRole('dialog', { name: /^Share 1:1 with / });
  await dialog.getByRole('textbox', { name: 'Your name' }).fill(MANAGER);
  await dialog.getByRole('button', { name: 'Create link' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Share it only with your direct report');
  await dialog.getByRole('button', { name: 'I understand' }).click();
  return dialog.getByRole('textbox', { name: 'Share link' }).inputValue();
}

async function openAsRecipient(browser: Browser, link: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  return { page, close: () => context.close() };
}

test.describe('engineer agenda items before the 1:1', () => {
  test('manager builds an agenda, shares it, and the engineer sees a read-only snapshot', async ({
    unlockedApp: page,
    browser,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await seedNotes(page, [
      { memberIndex: 0, content: 'Talked about the launch', hoursAgo: 2, visibility: 'shared' },
    ]);
    await openProfile(page);
    await expect(agendaCard(page)).toContainText('No agenda items yet. Add one below.');

    await addAgendaItem(page, SHARED_TOPIC, 'Alice Park');
    await addAgendaItem(page, HELD_BACK_TOPIC, 'Me');
    await agendaCard(page)
      .getByRole('checkbox', { name: `Include in share link: ${HELD_BACK_TOPIC}` })
      .uncheck();
    await expect(agendaCard(page).getByText('Not shared')).toHaveCount(1);
    await expect(agendaCard(page).getByLabel('Added by Alice Park')).toBeVisible();
    await expectNoViolations(page);

    const link = await createLink(page);
    const recipient = await openAsRecipient(browser, link);
    const view = recipient.page;

    const agenda = view.getByRole('region', { name: 'Agenda' });
    await expect(agenda.getByText(SHARED_TOPIC)).toBeVisible();
    await expect(agenda).toContainText('Agenda items as of');
    await expect(agenda).toContainText('cannot be edited');
    await expect(agenda.getByText('Added by you')).toBeVisible();
    expect((await view.locator('body').innerText()).toLowerCase()).not.toContain(
      HELD_BACK_TOPIC.toLowerCase(),
    );
    await expect(agenda.getByRole('textbox')).toHaveCount(0);
    await expect(agenda.getByRole('checkbox')).toHaveCount(0);
    await expect(agenda.getByRole('button')).toHaveCount(0);
    await expectNoViolations(view);
    await recipient.close();
  });

  test('manager removes an item and the agenda survives a reload', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await openProfile(page);
    await addAgendaItem(page, 'Keep this topic');
    await addAgendaItem(page, 'Drop this topic');

    await agendaCard(page)
      .getByRole('button', { name: 'Remove agenda item: Drop this topic' })
      .click();
    await expect(agendaList(page)).not.toContainText('Drop this topic');
    await expect(
      agendaCard(page).getByRole('heading', { name: "Engineer's Agenda" }),
    ).toBeFocused();

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await expect(agendaCard(page)).toContainText('Keep this topic');
    await expect(agendaCard(page)).not.toContainText('Drop this topic');
  });

  test('live mode lists the agenda as a checklist and ticked topics are struck through', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await seedAgenda(page, [
      { memberIndex: 0, text: 'First topic', addedBy: 'engineer', includeInShare: true },
      { memberIndex: 0, text: 'Second topic', addedBy: 'manager', includeInShare: true },
    ]);
    await openProfile(page);
    await page.getByRole('button', { name: 'Start 1:1' }).click();
    const dialog = page.getByRole('dialog', { name: /^1:1 with / });

    const box = dialog.getByRole('checkbox', { name: 'Mark First topic as discussed' });
    await expect(box).not.toBeChecked();
    await box.check();
    await expect(box).toBeChecked();
    await expect(dialog.getByText('First topic')).toHaveCSS('text-decoration-line', 'line-through');
    await expect(dialog.getByText('Second topic')).not.toHaveCSS(
      'text-decoration-line',
      'line-through',
    );
    await expect(dialog.getByRole('textbox', { name: 'Add an agenda item' })).toHaveCount(0);
    await expectNoViolations(page);
  });

  test('saving a 1:1 note archives the agenda so the next 1:1 starts clean', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await seedAgenda(page, [
      { memberIndex: 0, text: 'Last week topic', addedBy: 'engineer', includeInShare: true },
    ]);
    await openProfile(page);
    await expect(agendaCard(page)).toContainText('Last week topic');

    await page.getByRole('tab', { name: 'Notes' }).click();
    await page.getByRole('textbox', { name: '1:1 Notes' }).fill('We covered it');
    await page.getByRole('button', { name: 'Save Note' }).click();
    await expect(page.getByRole('list', { name: '1:1 notes history' })).toContainText(
      'We covered it',
    );

    await expect(agendaCard(page)).toContainText('No agenda items yet. Add one below.');
    await expect(agendaCard(page)).not.toContainText('Last week topic');
  });
});
