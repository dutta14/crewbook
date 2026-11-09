import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import {
  SEED_TEAM,
  seedCustomFieldDefinitions,
  seedId,
  seedMembers,
  type SeedCustomField,
} from './fixtures/seedMembers';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const go = async (page: Page, hash: string, heading: string | RegExp) => {
  await page.evaluate((target) => window.location.assign(target), hash);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
};

const openSettings = async (page: Page) => {
  await go(page, '#/settings', 'Settings');
  const section = page.getByRole('region', { name: 'Custom Fields' });
  await expect(section).toBeVisible();
  return section;
};

const openProfile = (page: Page, memberIndex: number) =>
  go(page, `#/person/${seedId(memberIndex)}`, SEED_TEAM[memberIndex].name);

const fieldRows = (section: Locator) =>
  section.getByRole('list', { name: 'Custom fields' }).getByRole('listitem');

const rowNames = async (section: Locator) =>
  (await fieldRows(section).locator('.custom-field-row__name').allTextContents()).map((name) =>
    name.trim(),
  );

const addField = async (section: Locator, name: string, type?: string, options?: string) => {
  await section.getByRole('button', { name: 'Add field' }).click();
  await section.getByLabel(/^Field name/).fill(name);
  if (type) await section.getByLabel('Type').selectOption({ label: type });
  if (options) await section.getByLabel('Select options, one per line').fill(options);
  await section.getByRole('button', { name: 'Save Field' }).click();
  await expect(section.getByLabel(/^Field name/)).toHaveCount(0);
  await expect(fieldRows(section).filter({ hasText: name })).toHaveCount(1);
};

const dragBelow = async (page: Page, handle: Locator, target: Locator) => {
  await target.scrollIntoViewIfNeeded();
  await handle.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('Both rows must be visible to drag');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 4, { steps: 12 });
  await page.mouse.up();
};

const reloadAndUnlock = async (page: Page) => {
  await page.reload();
  await unlock(page, TEST_PASSPHRASE);
};

test.describe('custom fields', () => {
  test('defines fields in Settings and fills them in on a profile, kept after a reload', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
    const section = await openSettings(page);
    await expect(section.getByText('No custom fields yet.')).toBeVisible();
    await expect(section.getByText(/stored in your encrypted vault/)).toBeVisible();
    await expectNoViolations(page);

    await addField(section, 'Squad');
    await addField(section, 'Shirt size', 'Select', 'Small\nMedium\nLarge');
    await addField(section, 'Certified on', 'Date');
    await addField(section, 'Wiki page', 'URL');
    await expect(section.getByText('4 / 10 fields used')).toBeVisible();
    await expect(section.getByText(/stored in your encrypted vault/)).toHaveCount(0);
    expect(await rowNames(section)).toEqual(['Squad', 'Shirt size', 'Certified on', 'Wiki page']);

    await openProfile(page, 0);
    const fields = page.getByRole('region', { name: 'Custom fields' });
    await expect(fields.getByRole('term')).toHaveText([
      'Squad',
      'Shirt size',
      'Certified on',
      'Wiki page',
    ]);
    await expect(fields.getByText('Not set')).toHaveCount(4);

    await page.getByRole('button', { name: "Edit Alice Park's profile" }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Team Member' });
    await dialog.getByLabel('Squad').fill('Payments');
    await dialog.getByLabel('Shirt size').selectOption('Medium');
    await dialog.getByLabel('Certified on').fill('2024-03-01');
    await dialog.getByLabel('Wiki page').fill('https://wiki.example.com/alice');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();

    await expect(fields.getByText('Payments')).toBeVisible();
    await expect(fields.getByText('Medium')).toBeVisible();
    await expect(fields.getByText('Mar 1, 2024')).toBeVisible();
    const link = fields.getByRole('link', { name: /wiki\.example\.com\/alice/ });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(fields.getByText('Not set')).toHaveCount(0);
    await expectNoViolations(page);

    await reloadAndUnlock(page);
    await openProfile(page, 0);
    await expect(fields.getByText('Payments')).toBeVisible();
    await openProfile(page, 1);
    await expect(fields.getByText('Not set')).toHaveCount(4);
  });

  test('rejects an unsafe link and HTML in a profile field without saving', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    await seedCustomFieldDefinitions(page, [
      { name: 'Squad', type: 'text' },
      { name: 'Wiki page', type: 'url' },
    ]);
    await openProfile(page, 0);

    await page.getByRole('button', { name: "Edit Alice Park's profile" }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit Team Member' });
    await dialog.getByLabel('Wiki page').fill('javascript:alert(1)');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog.getByLabel('Wiki page')).toHaveAccessibleDescription(
      'Enter a link that starts with https:// or http://',
    );
    await expect(dialog.getByLabel('Wiki page')).toBeFocused();

    await dialog.getByLabel('Wiki page').fill('');
    await dialog.getByLabel('Squad').fill('<img src=x onerror=alert(1)>');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog.getByLabel('Squad')).toHaveAccessibleDescription('Must not contain HTML');
    await expect(dialog).toBeVisible();
  });

  test('a value added while creating a member can be filtered on in the roster', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM);
    const section = await openSettings(page);
    await addField(section, 'Squad');
    await addField(section, 'Shirt size', 'Select', 'Small\nLarge');

    await go(page, '#/roster', 'Team');
    await page.getByRole('button', { name: 'Add member', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add Team Member' });
    await dialog.getByLabel('Name').fill('Priya Sharma');
    await dialog.getByLabel('Squad').fill('Payments');
    await dialog.getByLabel('Shirt size').selectOption('Large');
    await dialog.getByRole('button', { name: 'Add Member', exact: true }).click();
    await expect(dialog).toBeHidden();

    const rows = page.getByTestId('member-row');
    await expect(rows).toHaveCount(5);
    const filters = page.getByRole('group', { name: 'Filter by custom fields' });
    await filters.getByLabel('Squad').fill('pay');
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Priya Sharma');
    await expect(page.getByText('1 member found')).toBeAttached();

    await filters.getByLabel('Squad').fill('');
    await filters.getByLabel('Shirt size').selectOption('Small');
    await expect(page.getByText('No members found')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(rows).toHaveCount(5);
  });

  test('reorders fields by dragging a handle and keeps the order after a reload', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    await seedCustomFieldDefinitions(page, [
      { name: 'Alpha', type: 'text' },
      { name: 'Beta', type: 'text' },
      { name: 'Gamma', type: 'text' },
    ]);
    const section = await openSettings(page);

    await dragBelow(
      page,
      section.getByRole('button', { name: 'Reorder Alpha' }),
      fieldRows(section).nth(2),
    );

    await expect.poll(() => rowNames(section)).toEqual(['Beta', 'Gamma', 'Alpha']);

    await reloadAndUnlock(page);
    const reloaded = await openSettings(page);
    expect(await rowNames(reloaded)).toEqual(['Beta', 'Gamma', 'Alpha']);
    await openProfile(page, 0);
    await expect(page.getByRole('region', { name: 'Custom fields' }).getByRole('term')).toHaveText([
      'Beta',
      'Gamma',
      'Alpha',
    ]);
  });

  test('reorders with the keyboard and announces the new position', async ({
    unlockedApp: page,
  }) => {
    await seedCustomFieldDefinitions(page, [
      { name: 'Alpha', type: 'text' },
      { name: 'Beta', type: 'text' },
    ]);
    const section = await openSettings(page);
    const handle = section.getByRole('button', { name: 'Reorder Alpha' });

    await handle.focus();
    await page.keyboard.press('ArrowDown');

    await expect(section.getByRole('status')).toHaveText('Alpha moved to position 2');
    await expect(handle).toBeFocused();
    expect(await rowNames(section)).toEqual(['Beta', 'Alpha']);
    await page.keyboard.press('ArrowDown');
    expect(await rowNames(section)).toEqual(['Beta', 'Alpha']);
  });

  test('deleting a field warns how many people lose a value, then removes it everywhere', async ({
    unlockedApp: page,
  }) => {
    const squad = (index: number): Record<string, string> => ({ [`seed-field-${index}`]: 'x' });
    await seedMembers(page, [
      { ...SEED_TEAM[0], customFields: { ...squad(0), ...squad(1) } },
      { ...SEED_TEAM[1], customFields: squad(0) },
      SEED_TEAM[2],
    ]);
    const fields: SeedCustomField[] = [
      { name: 'Squad', type: 'text' },
      { name: 'Region', type: 'text' },
    ];
    await seedCustomFieldDefinitions(page, fields);
    const section = await openSettings(page);

    await section.getByRole('button', { name: 'Delete Squad field' }).click();
    const alert = page.getByRole('alertdialog');
    await expect(alert).toContainText(
      'Deleting this field will remove its value from all 2 team members. This cannot be undone.',
    );
    await expect(alert.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expectNoViolations(page);
    await alert.getByRole('button', { name: 'Cancel' }).click();
    await expect(alert).toBeHidden();
    expect(await rowNames(section)).toEqual(['Squad', 'Region']);

    await section.getByRole('button', { name: 'Delete Squad field' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete Field' }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    expect(await rowNames(section)).toEqual(['Region']);
    await expect(section.getByText('1 / 10 fields used')).toBeVisible();

    await reloadAndUnlock(page);
    await openProfile(page, 0);
    const profile = page.getByRole('region', { name: 'Custom fields' });
    await expect(profile.getByRole('term')).toHaveText(['Region']);
    await expect(profile.getByText('x')).toBeVisible();
    await openProfile(page, 1);
    await expect(profile.getByText('Not set')).toBeAttached();
  });

  test('stops at ten fields and offers adding again after one is removed', async ({
    unlockedApp: page,
  }) => {
    await seedCustomFieldDefinitions(
      page,
      Array.from({ length: 10 }, (_, index) => ({ name: `Field ${index + 1}`, type: 'text' })),
    );
    const section = await openSettings(page);
    const add = section.getByRole('button', { name: 'Add field' });

    await expect(section.getByText('10 / 10 fields used')).toBeVisible();
    await expect(add).toHaveAttribute('aria-disabled', 'true');
    await expect(add).toHaveAttribute('title', 'You can add up to 10 custom fields');
    await add.focus();
    await expect(add).toBeFocused();
    await add.click({ force: true });
    await expect(section.getByLabel(/^Field name/)).toHaveCount(0);

    await section.getByRole('button', { name: 'Delete Field 10 field' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete Field' }).click();
    await expect(section.getByText('9 / 10 fields used')).toBeVisible();
    await expect(add).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('stores custom field values only inside the encrypted vault', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, [{ ...SEED_TEAM[0], customFields: { 'seed-field-0': 'TOP-SECRET' } }]);
    await seedCustomFieldDefinitions(page, [{ name: 'Squad', type: 'text' }]);
    await openProfile(page, 0);

    await expect(page.getByText('TOP-SECRET')).toBeVisible();
    const stored = await page.evaluate(() =>
      Object.entries(window.localStorage).filter(([, value]) => value.includes('TOP-SECRET')),
    );
    expect(stored).toEqual([]);
  });
});
