import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures/auth';
import { SEED_TEAM, seedMembers } from './fixtures/seedMembers';

const rows = (page: import('@playwright/test').Page) => page.getByTestId('member-row');

const goToRoster = async (page: import('@playwright/test').Page) => {
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Team' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();
};

test.describe('roster with members', () => {
  test.beforeEach(async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM);
    await goToRoster(page);
  });

  test('shows each member with initials, name, role, level and a colour-coded status', async ({
    page,
  }) => {
    await expect(page.getByRole('table', { name: 'Team members' })).toBeVisible();
    await expect(rows(page)).toHaveCount(4);

    const alice = rows(page).filter({ hasText: 'Alice Park' });
    await expect(alice).toContainText('AP');
    await expect(alice).toContainText('Staff Engineer');
    await expect(alice).toContainText('L6');

    const colourOf = (name: string, label: string) =>
      rows(page)
        .filter({ hasText: name })
        .getByText(label, { exact: true })
        .evaluate((element) => getComputedStyle(element).backgroundColor);
    const colours = await Promise.all([
      colourOf('Alice Park', 'Active'),
      colourOf('Bob Singh', 'On leave'),
      colourOf('Carmen Diaz', 'Departing'),
      colourOf('Dev Patel', 'New hire'),
    ]);
    expect(colours).toEqual([
      'rgb(209, 250, 229)',
      'rgb(254, 243, 199)',
      'rgb(254, 226, 226)',
      'rgb(204, 251, 241)',
    ]);
  });

  test('shows a countdown for the new hire', async ({ page }) => {
    const devPatel = rows(page).filter({ hasText: 'Dev Patel' });

    await expect(devPatel.locator('time')).toHaveAttribute('datetime', '2099-06-15');
    await expect(devPatel.locator('time')).toHaveText(/^Starts in \d+ days$/);
  });

  test('clicking a row opens that member\u2019s profile route', async ({ page }) => {
    await rows(page).filter({ hasText: 'Carmen Diaz' }).click();

    await expect(page).toHaveURL(/#\/person\/seed-2$/);
  });

  test('search filters rows case-insensitively, announces the count and restores on clear', async ({
    page,
  }) => {
    const search = page.getByPlaceholder('Search by name or role...');

    await search.fill('engineer');
    await expect(rows(page)).toHaveCount(3);
    await expect(page.getByText('3 members found')).toBeAttached();

    await search.fill('ALICE');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Alice Park');
    await expect(page.getByText('1 member found')).toBeAttached();

    await search.fill('');
    await expect(rows(page)).toHaveCount(4);
    await expect(page.getByText('4 members found')).toBeAttached();
  });

  test('status chips narrow the list and All restores it', async ({ page }) => {
    const group = page.getByRole('radiogroup', { name: 'Filter by status' });

    await group.getByRole('radio', { name: 'On Leave' }).click();
    await expect(group.getByRole('radio', { name: 'On Leave' })).toBeChecked();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Bob Singh');

    await group.getByRole('radio', { name: 'Departing' }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Carmen Diaz');

    await group.getByRole('radio', { name: 'All' }).click();
    await expect(rows(page)).toHaveCount(4);
  });

  test('the selected chip uses the accent background', async ({ page }) => {
    const chip = page.getByRole('radio', { name: 'Active' });
    await chip.click();

    const accent = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--accent)';
      document.body.append(probe);
      const colour = getComputedStyle(probe).color;
      probe.remove();
      return colour;
    });
    // The chip colour transitions over 150ms.
    await expect
      .poll(() => chip.evaluate((element) => getComputedStyle(element).backgroundColor))
      .toBe(accent);
  });

  test('searching for nonsense shows the empty message and keeps the controls', async ({
    page,
  }) => {
    await page.getByPlaceholder('Search by name or role...').fill('zzznonexistent');

    await expect(page.getByText('No members found')).toBeVisible();
    await expect(page.getByText('0 members found')).toBeAttached();
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'Filter by status' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toBeVisible();
  });

  test('sorting by level and start date reorders the rows', async ({ page }) => {
    const sort = page.getByRole('combobox', { name: 'Sort by' });
    const links = rows(page).getByRole('link');

    await sort.selectOption('level');
    await expect(links).toHaveText(['Dev Patel', 'Carmen Diaz', 'Bob Singh', 'Alice Park']);

    await sort.selectOption('startDate');
    await expect(links).toHaveText(['Alice Park', 'Carmen Diaz', 'Bob Singh', 'Dev Patel']);

    await sort.selectOption('name');
    await expect(links).toHaveText(['Alice Park', 'Bob Singh', 'Carmen Diaz', 'Dev Patel']);
  });

  test('keeps search and filter state out of the URL and the page title', async ({ page }) => {
    await page.getByPlaceholder('Search by name or role...').fill('alice');
    await page.getByRole('radio', { name: 'Active' }).click();
    await expect(rows(page)).toHaveCount(1);

    await expect(page).toHaveURL(/#\/roster$/);
    await expect(page).toHaveTitle('Crewbook');
  });

  test('Tab order is search, filter chips, sort, then rows; Enter opens a profile', async ({
    page,
  }) => {
    const search = page.getByPlaceholder('Search by name or role...');
    await search.focus();
    await expect(search).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'All' })).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Active' })).toBeFocused();
    await expect(page.getByRole('radio', { name: 'Active' })).toBeChecked();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: 'All' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toBeFocused();

    await page.keyboard.press('Tab');
    const firstLink = rows(page).first().getByRole('link');
    await expect(firstLink).toBeFocused();
    const ring = await firstLink.evaluate(
      (element) => getComputedStyle(element, '::after').boxShadow,
    );
    expect(ring).not.toBe('none');

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/person\/seed-0$/);
  });

  for (const mode of ['light', 'dark'] as const) {
    test(`has no WCAG A/AA violations in ${mode} mode`, async ({ page }) => {
      if (mode === 'dark') {
        await page.getByRole('button', { name: 'Toggle dark mode' }).click();
        await expect(page.locator('body')).toHaveClass(/dark/);
      }
      await expect(rows(page)).toHaveCount(4);

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      expect(violations).toEqual([]);
    });
  }

  test('members persist across a reload and unlock', async ({ page }) => {
    await page.reload();
    await page.getByLabel('Passphrase', { exact: true }).fill('correct horse battery staple');
    await page.getByRole('button', { name: 'Unlock' }).click();

    await expect(rows(page)).toHaveCount(4);
  });
});

test.describe('roster on a narrow screen', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('shows cards instead of a table and opens a profile from a card', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM);
    await page.evaluate(() => window.location.assign('#/roster'));

    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(rows(page)).toHaveCount(4);

    await rows(page).filter({ hasText: 'Bob Singh' }).click();
    await expect(page).toHaveURL(/#\/person\/seed-1$/);
  });
});

test.describe('empty roster', () => {
  test('shows the empty state with a CTA and no rows', async ({ unlockedApp: page }) => {
    await goToRoster(page);

    await expect(
      page.getByRole('heading', { level: 2, name: 'No team members yet' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add your first team member' })).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByRole('table')).toHaveCount(0);
  });
});
