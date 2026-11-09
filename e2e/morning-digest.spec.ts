import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';
import {
  SEED_TEAM,
  seedActionItems,
  seedMembers,
  seedNotes,
  type SeedMember,
} from './fixtures/seedMembers';

const pad = (value: number) => String(value).padStart(2, '0');

/** A local YYYY-MM-DD, `offsetDays` from today. */
const isoDay = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const withSchedule = (member: SeedMember, offsetDays: number | null, time = '10:00'): SeedMember =>
  offsetDays === null
    ? member
    : {
        ...member,
        schedule: {
          cadence: 'weekly',
          dayOfWeek: 'monday',
          time,
          nextDate: isoDay(offsetDays),
        },
      };

const [ALICE, BOB, CARMEN] = SEED_TEAM;

const digest = (page: Page) => page.getByRole('region', { name: "Today's 1:1s" });
const rows = (page: Page) => digest(page).getByRole('link');

const expectNoViolations = async (page: Page) => {
  // Axe samples colours mid-fade otherwise.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

test.describe("today's 1:1s morning digest", () => {
  test('lists the 1:1s scheduled today in time order with counts and last met dates', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [
      withSchedule(ALICE, 0, '14:30'),
      withSchedule(BOB, 0, '09:00'),
      withSchedule(CARMEN, 1),
    ]);
    await seedActionItems(page, [
      { memberIndex: 0, title: 'First', dueInDays: 2 },
      { memberIndex: 0, title: 'Second' },
    ]);
    await seedNotes(page, [{ memberIndex: 0, content: 'Last time', hoursAgo: 24 * 5 }]);

    await expect(digest(page).getByRole('heading', { level: 3 })).toHaveText("Today's 1:1s");
    await expect(rows(page)).toHaveCount(2);
    const [first, second] = [rows(page).nth(0), rows(page).nth(1)];
    await expect(first).toContainText('Bob Singh');
    await expect(first).toContainText('9:00 AM');
    await expect(first).toContainText('Not met yet');
    await expect(first.getByRole('img')).toHaveCount(0);
    await expect(second).toContainText('Alice Park');
    await expect(second).toContainText('2:30 PM');
    await expect(second.getByRole('img')).toHaveText('2');
    await expect(second.locator('time')).toHaveAttribute('datetime', isoDay(-5));
    await expect(digest(page)).not.toContainText('Carmen Diaz');
    await expect(page).toHaveTitle('Crewbook');
    await expectNoViolations(page);
  });

  test('clicking an entry opens that profile and back returns to the digest', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [withSchedule(ALICE, 0)]);

    await rows(page).first().click();

    await expect(page.getByRole('heading', { level: 1, name: 'Alice Park' })).toBeVisible();
    expect(page.url()).toMatch(/#\/person\/[0-9a-f-]{36}$/);
    expect(page.url()).not.toContain('Alice');
    await page.goBack();
    await expect(digest(page)).toBeVisible();
    await expect(rows(page)).toHaveCount(1);
  });

  test('says nothing is scheduled today when the 1:1s are on other days', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [withSchedule(ALICE, 3), withSchedule(BOB, 1, '11:00')]);

    await expect(digest(page).getByText('No 1:1s scheduled today')).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    await expectNoViolations(page);
  });

  test('omits the next line when nobody has a schedule', async ({ unlockedApp: page }) => {
    await seedMembers(page, [ALICE, BOB]);

    await expect(digest(page).getByText('No 1:1s scheduled today')).toBeVisible();
    await expect(digest(page).getByText(/^Next:/)).toHaveCount(0);
  });

  test('shows the open action item count and leads to the overdue items', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [withSchedule(ALICE, 0)]);
    await seedActionItems(page, [
      { memberIndex: 0, title: 'Overdue follow-up', dueInDays: -2 },
      { memberIndex: 0, title: 'Due soon', dueInDays: 1 },
      { memberIndex: 0, title: 'No date' },
      { memberIndex: 0, title: 'Finished', status: 'done' },
    ]);

    const pill = rows(page).first().getByLabel('3 open action items');
    await expect(pill).toHaveText('3');

    await rows(page).first().click();
    await page.getByRole('tab', { name: 'Notes' }).click();
    await expect(page.getByRole('list', { name: 'Open action items' })).toContainText('Overdue');
  });

  test('keyboard users tab through the entries and open one with Enter', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [withSchedule(ALICE, 0, '09:00'), withSchedule(BOB, 0, '10:00')]);

    await page.getByRole('button', { name: 'Log feedback', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: "Toggle Today's 1:1s" })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(rows(page).nth(0)).toBeFocused();
    await expect(rows(page).nth(0)).not.toHaveCSS('box-shadow', 'none');
    await page.keyboard.press('Tab');
    await expect(rows(page).nth(1)).toBeFocused();
    for (const index of [0, 1]) {
      const box = await rows(page).nth(index).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Bob Singh' })).toBeVisible();
  });
});
