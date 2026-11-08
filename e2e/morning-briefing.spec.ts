import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test, unlock } from './fixtures/auth';
import {
  SEED_TEAM,
  isoDateInDays,
  isoDateYearsAgo,
  seedDateEvents,
  seedMembers,
  seedReminders,
  seedTodos,
  type SeedMember,
} from './fixtures/seedMembers';

const pad = (value: number) => String(value).padStart(2, '0');

/** A local YYYY-MM-DD, `offsetDays` from today. */
const isoDay = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const withSchedule = (member: SeedMember, offsetDays: number, time = '10:00'): SeedMember => ({
  ...member,
  schedule: { cadence: 'weekly', dayOfWeek: 'monday', time, nextDate: isoDay(offsetDays) },
});

const [ALICE, BOB, CARMEN] = SEED_TEAM;
// Started recently enough that no anniversary falls inside any reminder lead time.
const NEW_ENOUGH = { startDate: isoDateInDays(-180) };

const GREETING = /^Good (morning|afternoon|evening)$/;
const COLLAPSE_KEY = 'dashboard-collapse-state';

const section = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

test.describe('daily briefing dashboard', () => {
  test('is the home page and gathers everything that needs attention today', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [
      { ...withSchedule(ALICE, 0, '14:30'), startDate: isoDateYearsAgo(2) },
      BOB,
      CARMEN,
    ]);
    await seedTodos(page, [
      { title: 'Draft the promo packet', dueInDays: 0, priority: 'high' },
      { title: 'Book the offsite', dueInDays: 3 },
    ]);
    await seedReminders(
      page,
      [
        {
          text: 'Congratulate on the launch',
          memberIndex: 2,
          triggerType: 'specific_date',
          triggerInDays: 0,
        },
      ],
      [ALICE, BOB, CARMEN],
    );

    await expect(page.getByRole('heading', { level: 1, name: GREETING })).toBeVisible();
    expect(new URL(page.url()).hash).toMatch(/^(#\/?)?$/);
    await expect(page.locator('time')).toHaveAttribute('datetime', isoDay(0));
    await expect(page.getByRole('region', { name: 'Daily briefing' })).toBeVisible();

    await expect(
      section(page, "Today's 1:1s").getByRole('link', { name: '1:1 with Alice Park at 2:30 PM' }),
    ).toBeVisible();
    await expect(section(page, 'Action Items')).toContainText('Draft the promo packet');
    await expect(section(page, 'Action Items')).not.toContainText('Book the offsite');
    await expect(section(page, 'Reminders')).toContainText('Congratulate on the launch');
    await expect(section(page, 'Birthdays & Anniversaries')).toContainText('2-year anniversary');
    await expect(
      section(page, 'On Leave').getByRole('link', { name: 'Bob Singh, Away' }),
    ).toBeVisible();
    await expect(page).toHaveTitle('Crewbook');
    await expectNoViolations(page);
  });

  test('opens a profile from a row and returns to the briefing', async ({ unlockedApp: page }) => {
    await seedMembers(page, [withSchedule(ALICE, 0)]);

    await section(page, "Today's 1:1s").getByRole('link').first().click();

    await expect(page.getByRole('heading', { level: 1, name: 'Alice Park' })).toBeVisible();
    expect(page.url()).toMatch(/#\/person\/[0-9a-f-]{36}$/);
    expect(page.url()).not.toContain('Alice');
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: GREETING })).toBeVisible();
  });

  test('shows an all-clear message with the next 1:1 when nothing needs attention', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [{ ...withSchedule(ALICE, 2), ...NEW_ENOUGH }]);

    const weekday = new Date(isoDay(2) + 'T12:00:00').toLocaleDateString(undefined, {
      weekday: 'long',
    });
    await expect(
      page.getByText(`All clear today. Your next 1:1 is with Alice Park on ${weekday}.`),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: "Today's 1:1s" })).toHaveCount(0);
    await expectNoViolations(page);
  });

  test('remembers which sections are collapsed after a reload', async ({ unlockedApp: page }) => {
    await seedMembers(page, [withSchedule(ALICE, 0)]);
    const toggle = page.getByRole('button', { name: "Toggle Today's 1:1s" });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(section(page, "Today's 1:1s").getByRole('link')).toBeHidden();
    const saved = await page.evaluate((key) => window.localStorage.getItem(key), COLLAPSE_KEY);
    expect(JSON.parse(saved ?? '')).toEqual({ 'todays-one-ones': true });

    await page.reload();
    await unlock(page);

    const reloaded = page.getByRole('button', { name: "Toggle Today's 1:1s" });
    await expect(reloaded).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Toggle Overdue 1:1s' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await reloaded.click();
    await expect(section(page, "Today's 1:1s").getByRole('link')).toBeVisible();
  });

  test('ticks off a task due today and keeps it ticked after a reload', async ({
    unlockedApp: page,
  }) => {
    await seedTodos(page, [{ title: 'Send the feedback', dueInDays: 0 }]);
    const box = page.getByRole('checkbox', { name: 'Send the feedback' });
    await expect(box).not.toBeChecked();

    await box.check();

    await expect(box).toBeChecked();
    await page.reload();
    await unlock(page);
    await expect(page.getByRole('checkbox', { name: 'Send the feedback' })).toBeChecked();
  });

  test('shows a birthday today and a conversation starter in italics', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [{ ...ALICE, ...NEW_ENOUGH }]);
    await seedDateEvents(page, [{ memberIndex: 0, type: 'birthday', date: isoDateYearsAgo(30) }]);

    await expect(
      section(page, 'Birthdays & Anniversaries').getByRole('link', {
        name: 'Alice Park: Birthday, Today',
      }),
    ).toBeVisible();
  });

  // Not covered here: the PTO / Sick / Parental leave colour pairs. The PTO calendar (#22) is not
  // built yet, so a leave type is not recorded and every absence reads "Away".
});
