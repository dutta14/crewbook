import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';
import { SEED_TEAM, seedId, seedMembers, seedMoods } from './fixtures/seedMembers';

const SWITCH = 'Track energy/mood after 1:1s';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const setMoodTracking = async (page: Page, enabled: boolean) => {
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  const toggle = page.getByRole('switch', { name: SWITCH });
  await (enabled ? toggle.check() : toggle.uncheck());
  await expect(toggle).toBeChecked({ checked: enabled });
};

const openProfile = async (page: Page, memberIndex = 0) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

const openNotes = async (page: Page) => {
  await page.getByRole('tab', { name: 'Notes' }).click();
  await expect(page.getByRole('textbox', { name: '1:1 Notes' })).toBeVisible();
};

const saveNote = async (page: Page, text: string) => {
  await page.getByRole('textbox', { name: '1:1 Notes' }).fill(text);
  await page.getByRole('button', { name: 'Save Note' }).click();
  await expect(page.getByRole('list', { name: '1:1 notes history' })).toContainText(text);
};

const showTrend = async (page: Page) => {
  const section = page.getByRole('region', { name: 'Energy trend (private)' });
  await section.scrollIntoViewIfNeeded();
  await section.getByRole('button', { name: 'Show' }).click();
  return section;
};

test.describe('mood and energy tracking', () => {
  test('manager logs mood after a 1:1 and sees it on the trend chart', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await setMoodTracking(page, true);
    await openProfile(page);
    await openNotes(page);
    await expect(page.getByRole('radiogroup', { name: 'Energy level' })).toHaveCount(0);

    await saveNote(page, 'Talked about the launch');
    const group = page.getByRole('radiogroup', { name: 'Energy level' });
    await expect(group).toBeVisible();
    await expect(group.getByText('Private')).toBeVisible();
    await group.getByRole('radio', { name: 'Great energy' }).click();
    await expect(group.getByRole('radio', { name: 'Great energy' })).toBeChecked();

    const section = await showTrend(page);
    await expect(section.getByTestId('mood-dot')).toHaveCount(1);
    await section.getByTestId('mood-dot').hover();
    await expect(section.getByRole('tooltip')).toContainText('😊');
    await expect(section.getByRole('row', { name: /Great energy/ })).toHaveCount(1);
    await expectNoViolations(page);
  });

  test('manager deselects mood so no data point is recorded', async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await setMoodTracking(page, true);
    await openProfile(page);
    await openNotes(page);
    await saveNote(page, 'A quiet check-in');

    const neutral = page.getByRole('radio', { name: 'Neutral' });
    await neutral.click();
    await expect(neutral).toBeChecked();
    await neutral.click();
    await expect(neutral).not.toBeChecked();

    const section = await showTrend(page);
    await expect(section.getByText('No mood data recorded yet')).toBeVisible();
    await expect(section.getByTestId('mood-dot')).toHaveCount(0);
  });

  test('selector is single tab stop with arrow key navigation', async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await setMoodTracking(page, true);
    await openProfile(page);
    await openNotes(page);
    await saveNote(page, 'Keyboard check');

    await page.getByRole('radio', { name: 'Very low energy' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Low energy', exact: true })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('radio', { name: 'Low energy', exact: true })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Low energy', exact: true })).toHaveAttribute(
      'tabindex',
      '0',
    );
    await expect(page.getByRole('radio', { name: 'Neutral' })).toHaveAttribute('tabindex', '-1');
  });

  test('manager disables mood tracking in settings and the selector disappears', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await setMoodTracking(page, true);
    await setMoodTracking(page, false);
    await expectNoViolations(page);

    await openProfile(page);
    await expect(page.getByRole('heading', { name: 'Energy trend (private)' })).toHaveCount(0);
    await openNotes(page);
    await saveNote(page, 'No mood prompt expected');

    await expect(page.getByRole('radiogroup')).toHaveCount(0);
    await expect(page.getByText('How did they seem?')).toHaveCount(0);
  });

  test('mood tracking is off until the manager opts in', async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('switch', { name: SWITCH })).not.toBeChecked();
    await openProfile(page);
    await expect(page.getByRole('heading', { name: 'Energy trend (private)' })).toHaveCount(0);
  });

  test('trend chart shows an empty state when no mood data exists', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await setMoodTracking(page, true);
    await openProfile(page, 1);

    const section = page.getByRole('region', { name: 'Energy trend (private)' });
    await expect(section.getByRole('button', { name: 'Show' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(section.getByText('No mood data recorded yet')).toHaveCount(0);
    await showTrend(page);

    await expect(section.getByText('No mood data recorded yet')).toBeVisible();
    await expect(section.getByRole('img')).toHaveCount(0);
    await expectNoViolations(page);
  });

  test('manager sees several logged moods and a tooltip on hover', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await seedMoods(page, [
      { memberIndex: 0, score: 2, daysAgo: 21 },
      { memberIndex: 0, score: 3, daysAgo: 14 },
      { memberIndex: 0, score: 5, daysAgo: 7 },
      { memberIndex: 1, score: 1, daysAgo: 7 },
    ]);
    await setMoodTracking(page, true);
    await openProfile(page);

    const section = await showTrend(page);

    await expect(
      section.getByRole('img', { name: 'Energy trend over last 3 sessions' }),
    ).toBeVisible();
    await expect(section.getByTestId('mood-dot')).toHaveCount(3);
    await section.getByTestId('mood-dot').nth(2).hover();
    await expect(section.getByRole('tooltip')).toContainText('😊');
    await section.getByTestId('mood-dot').nth(0).hover();
    await expect(section.getByRole('tooltip')).toContainText('😕');
    await expectNoViolations(page);
  });

  test('ratings never show on the roster and disappear with the member', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    await seedMoods(page, [{ memberIndex: 0, score: 1, daysAgo: 3 }]);
    await setMoodTracking(page, true);

    await page.getByRole('link', { name: 'Team' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();
    for (const emoji of ['😟', '😕', '😐', '🙂', '😊']) {
      await expect(page.getByText(emoji)).toHaveCount(0);
    }

    await openProfile(page);
    await page.getByRole('button', { name: 'Delete Alice Park' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();
    await expect(page.getByText('Alice Park removed from your team')).toBeVisible();
  });
});
