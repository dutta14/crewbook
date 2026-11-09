import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedId, seedMembers, seedSkills } from './fixtures/seedMembers';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const openSkillsTab = async (page: Page, memberIndex: number) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('tab', { name: 'Skills' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Skills' });
  await expect(panel.getByRole('region', { name: 'Strengths' })).toBeVisible();
  return panel;
};

const addStrength = async (
  panel: ReturnType<Page['getByRole']>,
  name: string,
  level: string,
  notes?: string,
) => {
  await panel.getByRole('button', { name: 'Add skill to Strengths' }).click();
  await panel.getByRole('textbox', { name: /Skill name/ }).fill(name);
  await panel.getByLabel('Proficiency level').selectOption({ label: level });
  if (notes) await panel.getByLabel('Notes (optional)').fill(notes);
  await panel.getByRole('button', { name: 'Save' }).click();
  await expect(panel.getByRole('textbox', { name: /Skill name/ })).toHaveCount(0);
};

const openMatrix = async (page: Page) => {
  await page.getByRole('link', { name: 'Skills Matrix' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Skills Matrix' })).toBeVisible();
};

test.describe('skills matrix', () => {
  test.beforeEach(async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
  });

  test('skills added on two profiles appear in the team matrix and survive a reload', async ({
    unlockedApp: page,
  }) => {
    const alice = await openSkillsTab(page, 0);
    await expect(alice.getByRole('heading', { name: 'No strengths documented yet' })).toBeVisible();
    await expectNoViolations(page);
    await addStrength(alice, 'React', 'Expert', 'Leads our component library');
    await addStrength(alice, 'TypeScript', 'Proficient');
    await expect(alice.getByText('Leads our component library')).toBeVisible();

    const bob = await openSkillsTab(page, 1);
    await addStrength(bob, 'React', 'Learning');
    await expectNoViolations(page);

    await openMatrix(page);
    const table = page.getByRole('table', { name: 'Skills documented for each team member' });
    await expect(table.getByRole('columnheader')).toHaveText([
      'Team member',
      'React',
      'TypeScript',
    ]);
    const aliceRow = table.getByRole('row', { name: /Alice Park/ });
    await expect(aliceRow.getByRole('cell')).toHaveText(['Expert', 'Proficient']);
    const bobRow = table.getByRole('row', { name: /Bob Singh/ });
    await expect(bobRow.getByRole('cell').first()).toHaveText('Learning');
    await expect(bobRow.getByRole('cell').last()).toContainText('Not documented');
    await expectNoViolations(page);

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await openMatrix(page);
    await expect(
      page
        .getByRole('table')
        .getByRole('row', { name: /Alice Park/ })
        .getByRole('cell'),
    ).toHaveText(['Expert', 'Proficient']);
  });

  test('the matrix filters to the skill that was typed, whatever its case', async ({
    unlockedApp: page,
  }) => {
    await seedSkills(page, [
      { memberIndex: 0, name: 'React', level: 'expert' },
      { memberIndex: 0, name: 'Go', level: 'competent' },
      { memberIndex: 1, name: 'Python', level: 'learning' },
    ]);
    await openMatrix(page);

    await page.getByRole('searchbox', { name: 'Filter skills' }).fill('rEaCt');

    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader')).toHaveText(['Team member', 'React']);
    await expect(table.getByRole('rowheader')).toHaveText([/Alice Park$/]);
    await expect(page.getByText('1 matching skill')).toBeVisible();

    await page.getByRole('searchbox', { name: 'Filter skills' }).fill('nothing like this');
    await expect(page.getByText('No skill matches that filter.')).toBeVisible();
    await expect(table).toHaveCount(0);
  });

  test('a skill can be edited and the change shows in the matrix after a reload', async ({
    unlockedApp: page,
  }) => {
    await seedSkills(page, [{ memberIndex: 0, name: 'Typescript', level: 'learning' }]);
    const panel = await openSkillsTab(page, 0);

    await panel.getByRole('button', { name: 'Edit Typescript' }).click();
    await expect(panel.getByRole('textbox', { name: /Skill name/ })).toHaveValue('Typescript');
    await panel.getByRole('textbox', { name: /Skill name/ }).fill('TypeScript');
    await panel.getByLabel('Proficiency level').selectOption({ label: 'Expert' });
    await panel.getByRole('button', { name: 'Save' }).click();

    await expect(panel.getByText('TypeScript', { exact: true })).toBeVisible();
    await expect(panel.getByText('Expert')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Edit TypeScript' })).toBeFocused();

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    await openMatrix(page);
    await expect(page.getByRole('columnheader', { name: 'TypeScript' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Alice Park/ })).toContainText('Expert');
  });

  test('a duplicate skill name in the same section is refused with a message', async ({
    unlockedApp: page,
  }) => {
    await seedSkills(page, [{ memberIndex: 0, name: 'React', level: 'expert' }]);
    const panel = await openSkillsTab(page, 0);

    await panel.getByRole('button', { name: 'Add skill to Strengths' }).click();
    await panel.getByRole('textbox', { name: /Skill name/ }).fill('react');
    await panel.getByRole('button', { name: 'Save' }).click();

    await expect(panel.getByText('Strengths already has a skill with that name')).toBeVisible();
    await expect(panel.getByRole('textbox', { name: /Skill name/ })).toBeFocused();
    await expectNoViolations(page);
  });

  test('removing a skill asks first and keeps it when declined', async ({ unlockedApp: page }) => {
    await seedSkills(page, [
      { memberIndex: 0, name: 'React', level: 'expert' },
      { memberIndex: 0, name: 'Rust', level: 'learning', category: 'growth' },
    ]);
    const panel = await openSkillsTab(page, 0);
    const growth = panel.getByRole('region', { name: 'Growth Areas' });

    await growth.getByRole('button', { name: 'Remove Rust' }).click();
    await expect(growth.getByRole('group', { name: 'Remove Rust?' })).toBeVisible();
    await expect(growth.getByRole('button', { name: 'No' })).toBeFocused();
    await growth.getByRole('button', { name: 'No' }).click();
    await expect(growth.getByText('Rust', { exact: true })).toBeVisible();

    await growth.getByRole('button', { name: 'Remove Rust' }).click();
    await growth.getByRole('button', { name: 'Yes' }).click();
    await expect(
      growth.getByRole('heading', { name: 'No growth areas documented yet' }),
    ).toBeVisible();
    await expect(panel.getByText('React', { exact: true })).toBeVisible();

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    const reloaded = await openSkillsTab(page, 0);
    await expect(
      reloaded
        .getByRole('region', { name: 'Growth Areas' })
        .getByText('No growth areas documented yet'),
    ).toBeVisible();
  });

  test('the matrix shows an empty state before any skill is documented', async ({
    unlockedApp: page,
  }) => {
    await openMatrix(page);

    await expect(page.getByRole('heading', { name: 'No skills documented yet' })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    await expectNoViolations(page);
  });

  test('deleting a person removes their skills from the matrix', async ({ unlockedApp: page }) => {
    await seedSkills(page, [
      { memberIndex: 0, name: 'React', level: 'expert' },
      { memberIndex: 1, name: 'Go', level: 'competent' },
    ]);
    await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(0));
    await page.getByRole('button', { name: 'Delete Alice Park' }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();

    await openMatrix(page);

    await expect(page.getByRole('columnheader')).toHaveText(['Team member', 'Go']);
    await expect(page.getByRole('rowheader')).toHaveText([/Bob Singh$/]);
  });

  test('on a phone the matrix becomes one card per person', async ({ unlockedApp: page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await seedSkills(page, [
      { memberIndex: 0, name: 'React', level: 'expert' },
      { memberIndex: 1, name: 'Go', level: 'competent' },
    ]);
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await openMatrix(page);

    await expect(page.getByRole('table')).toHaveCount(0);
    const cards = page.getByRole('list', { name: 'Skills by team member' }).locator('> li');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('Alice Park');
    await expect(cards.first()).toContainText('React');
    await expect(cards.first()).toContainText('Expert');
    await expect(cards.first()).not.toContainText('Go');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expectNoViolations(page);
  });
});
