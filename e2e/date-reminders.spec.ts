import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';
import {
  SEED_TEAM,
  isoDateInDays,
  isoDateYearsAgo,
  seedDateEvents,
  seedId,
  seedMembers,
} from './fixtures/seedMembers';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const go = async (page: Page, hash: string, heading: string | RegExp) => {
  await page.evaluate((target) => window.location.assign(target), hash);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
};

const openDashboard = (page: Page) => go(page, '#/', /^Good (morning|afternoon|evening)$/);
const openSettings = (page: Page) => go(page, '#/settings', 'Settings');

const openProfile = async (page: Page, memberIndex = 0) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

const alice = { ...SEED_TEAM[0], startDate: '2019-04-01' };

test.describe('date-triggered reminders', () => {
  test('a visa expiry set on the profile reminds on the dashboard with generic wording until expanded', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [alice]);
    await openProfile(page);
    const keyDates = page.getByRole('region', { name: 'Key Dates' });
    await keyDates.getByRole('button', { name: 'Set Visa expiry' }).click();
    await keyDates.getByLabel('Visa expiry').fill(isoDateInDays(25));
    await keyDates.getByRole('button', { name: 'Save' }).click();
    await expect(keyDates.getByRole('button', { name: 'Edit Visa expiry' })).toBeFocused();

    await openDashboard(page);

    const reminders = page.getByRole('region', { name: 'Reminders' });
    const card = reminders.locator('.date-reminder-card[data-event-type="visa_expiry"]');
    await expect(card).toContainText('Important date for Alice in 25 days');
    await expect(card.locator('[data-icon="visa_expiry"] svg')).toBeVisible();
    await expect(card).not.toContainText(/visa/i);
    await card.getByRole('button', { name: "Show details for Alice's important date" }).click();
    await expect(card).toContainText('Visa expiry:');
    await expectNoViolations(page);

    await page.reload();
    await page.getByLabel('Passphrase', { exact: true }).fill('correct horse battery staple');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(
      page
        .getByRole('region', { name: 'Reminders' })
        .locator('.date-reminder-card[data-event-type="visa_expiry"]'),
    ).toContainText('Important date for Alice in 25 days');
  });

  test('an anniversary today shows its tenure and an italic conversation starter', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [{ ...alice, startDate: isoDateYearsAgo(2) }]);

    await openDashboard(page);

    const section = page.getByRole('region', { name: 'Birthdays & Anniversaries' });
    const row = section.getByRole('listitem').filter({ hasText: 'Alice Park' });
    await expect(row).toContainText('2-year anniversary');
    await expect(row).toContainText('Today');
    const starter = row.locator('.date-reminder__starter');
    await expect(starter).toContainText("Alice's 2-year anniversary is today");
    await expect(starter).toHaveCSS('font-style', 'italic');
    await expectNoViolations(page);
  });

  test('a longer probation lead time in settings brings the reminder forward', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [alice]);
    await seedDateEvents(page, [
      { memberIndex: 0, type: 'probation_end', date: isoDateInDays(18) },
    ]);
    await expect(page.locator('.date-reminder-card')).toHaveCount(0);

    await openSettings(page);
    const lead = page.getByRole('region', { name: 'Reminder Lead Times' });
    await expect(lead.getByRole('spinbutton', { name: 'Probation end' })).toHaveValue('14');
    await expectNoViolations(page);
    await lead.getByRole('spinbutton', { name: 'Probation end' }).fill('21');
    await lead.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Lead times saved')).toBeVisible();

    await openDashboard(page);
    const card = page.locator('.date-reminder-card[data-event-type="probation_end"]');
    await expect(card).toContainText('Important date for Alice in 18 days');
    await expect(card.locator('[data-icon="probation_end"] svg')).toBeVisible();
  });

  test('a lead time outside 1 to 90 is refused with a message', async ({ unlockedApp: page }) => {
    await openSettings(page);
    const lead = page.getByRole('region', { name: 'Reminder Lead Times' });

    await lead.getByRole('spinbutton', { name: 'Birthday' }).fill('120');
    await lead.getByRole('button', { name: 'Save' }).click();

    await expect(lead.getByRole('alert')).toHaveText('Enter a whole number from 1 to 90');
    await expect(page.getByText('Lead times saved')).toHaveCount(0);
    await expectNoViolations(page);
  });

  test('unset dates read Not set, offer a picker and make no reminders', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [alice]);

    await openDashboard(page);
    await expect(page.locator('.date-reminder-card')).toHaveCount(0);

    await openProfile(page);
    const keyDates = page.getByRole('region', { name: 'Key Dates' });
    for (const name of ['Set Visa expiry', 'Set Probation end', 'Set Birthday']) {
      await expect(keyDates.getByRole('button', { name })).toHaveText('Not set');
    }
    await expect(
      keyDates.getByRole('group', { name: /^Work anniversary: .*auto-calculated$/ }),
    ).toBeVisible();
    await keyDates.getByRole('button', { name: 'Set Birthday' }).click();
    await expect(keyDates.getByLabel('Birthday')).toHaveAttribute('type', 'date');
    await expect(keyDates.getByLabel('Birthday')).toHaveAttribute('autocomplete', 'off');
    await expectNoViolations(page);
  });

  test('a birthday today shows a cake and no sensitive date is visible on the profile until revealed', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [alice]);
    await seedDateEvents(page, [
      { memberIndex: 0, type: 'birthday', date: isoDateYearsAgo(30) },
      { memberIndex: 0, type: 'visa_expiry', date: '2031-01-15' },
    ]);

    await openDashboard(page);
    const row = page
      .getByRole('region', { name: 'Birthdays & Anniversaries' })
      .getByRole('link', { name: 'Alice Park: Birthday, Today' });
    await expect(row).toBeVisible();

    await openProfile(page);
    const keyDates = page.getByRole('region', { name: 'Key Dates' });
    await expect(keyDates).not.toContainText('Jan 15, 2031');
    await keyDates.getByRole('button', { name: 'Show sensitive dates' }).click();
    await expect(keyDates).toContainText('Jan 15, 2031');
    await expectNoViolations(page);
  });
});
