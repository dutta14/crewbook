import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { TEST_PASSPHRASE, expect, test, unlock } from './fixtures/auth';
import { SEED_TEAM, seedId, seedMembers } from './fixtures/seedMembers';

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const openProfile = async (page: Page, memberIndex: number) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const documents = page.getByRole('region', { name: 'Documents' });
  await expect(documents).toBeVisible();
  return documents;
};

const addLink = async (documents: Locator, title: string, url: string, category: string) => {
  await documents.getByRole('button', { name: 'Add document link' }).click();
  await documents.getByLabel(/^Title/).fill(title);
  await documents.getByLabel(/^Link/).fill(url);
  await documents.getByLabel('Category').selectOption({ label: category });
  await documents.getByRole('button', { name: 'Save' }).click();
  await expect(documents.getByRole('form')).toHaveCount(0);
};

test.describe('document links', () => {
  test.beforeEach(async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 2));
  });

  test('lives on the Overview tab without adding a tab', async ({ unlockedApp: page }) => {
    await openProfile(page, 0);

    await expect(page.getByRole('tab')).toHaveCount(10);
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('tab', { name: 'Notes' }).click();
    await expect(page.getByRole('region', { name: 'Documents' })).toHaveCount(0);
  });

  test('adds links in several categories, groups them, and keeps them after a reload', async ({
    unlockedApp: page,
  }) => {
    const documents = await openProfile(page, 0);
    await expect(documents.getByRole('heading', { name: 'No documents linked yet' })).toBeVisible();
    await expectNoViolations(page);

    await addLink(
      documents,
      'Q3 promo packet',
      'https://docs.google.com/document/d/abc123?tab=t.0',
      'Promo Packets',
    );
    await addLink(documents, 'Staff ladder', 'http://wiki.example.com/ladder', 'Career Ladder');
    await addLink(documents, 'FY26 IDP', 'https://wiki.example.com/idp', 'IDPs');
    await addLink(documents, 'H1 self review', 'https://wiki.example.com/h1', 'Self Reviews');

    await expect(documents.getByRole('region')).toHaveCount(4);
    await expect(documents.getByRole('region').first()).toContainText('Promo Packets');
    await expect(documents.getByRole('region').last()).toContainText('IDPs');
    await expect(documents.getByRole('region', { name: /Other/ })).toHaveCount(0);

    const promo = documents.getByRole('region', { name: /Promo Packets/ });
    const link = promo.getByRole('link', { name: /Q3 promo packet/ });
    await expect(link).toHaveAttribute('href', 'https://docs.google.com/document/d/abc123?tab=t.0');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(promo.getByText('docs.google.com')).toBeVisible();
    await expect(promo.getByText('Updated today')).toBeVisible();
    await expectNoViolations(page);

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    const after = await openProfile(page, 0);
    await expect(after.getByRole('link', { name: /Q3 promo packet/ })).toBeVisible();
    await expect(after.getByRole('link', { name: /FY26 IDP/ })).toBeVisible();

    const other = await openProfile(page, 1);
    await expect(other.getByRole('heading', { name: 'No documents linked yet' })).toBeVisible();
  });

  test('is accessible in dark mode too', async ({ unlockedApp: page }) => {
    const documents = await openProfile(page, 0);
    await addLink(documents, 'Q3 promo packet', 'https://docs.google.com/d/1', 'Promo Packets');
    await page.getByRole('button', { name: 'Toggle dark mode' }).click();
    await expect(page.locator('body')).toHaveClass(/dark/);

    await expectNoViolations(page);
  });

  test('refuses anything that is not a web link and saves nothing', async ({
    unlockedApp: page,
  }) => {
    const documents = await openProfile(page, 0);
    await documents.getByRole('button', { name: 'Add document link' }).click();
    await documents.getByLabel(/^Title/).fill('Sneaky');
    const url = documents.getByLabel(/^Link/);

    for (const bad of [
      'javascript:alert(document.domain)',
      'data:text/html,hi',
      'file:///etc/hosts',
    ]) {
      await url.fill(bad);
      await documents.getByRole('button', { name: 'Save' }).click();
      await expect(url).toHaveAttribute('aria-invalid', 'true');
      await expect(
        documents.getByText('Enter a link that starts with https:// or http://'),
      ).toBeVisible();
    }
    await expectNoViolations(page);

    await documents.getByRole('button', { name: 'Cancel' }).click();
    await expect(documents.getByRole('heading', { name: 'No documents linked yet' })).toBeVisible();
  });

  test('edits a link into another category and removes it after a confirmation', async ({
    unlockedApp: page,
  }) => {
    const documents = await openProfile(page, 0);
    await addLink(documents, 'Draft packet', 'https://docs.google.com/d/1', 'Other');

    await documents.getByRole('button', { name: 'Edit Draft packet' }).click();
    await expect(documents.getByLabel(/^Title/)).toHaveValue('Draft packet');
    await documents.getByLabel(/^Title/).fill('Final packet');
    await documents.getByLabel('Category').selectOption({ label: 'Promo Packets' });
    await documents.getByRole('button', { name: 'Save' }).click();
    await expect(documents.getByRole('region', { name: /Promo Packets/ })).toContainText(
      'Final packet',
    );
    await expect(documents.getByRole('region', { name: /Other/ })).toHaveCount(0);

    await documents.getByRole('button', { name: 'Remove Final packet' }).click();
    await expect(documents.getByRole('alertdialog')).toBeVisible();
    await expect(documents.getByRole('button', { name: 'No' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(documents.getByRole('alertdialog')).toHaveCount(0);
    await expect(documents.getByRole('button', { name: 'Remove Final packet' })).toBeFocused();

    await documents.getByRole('button', { name: 'Remove Final packet' }).click();
    await documents.getByRole('button', { name: 'Yes' }).click();
    await expect(documents.getByRole('heading', { name: 'No documents linked yet' })).toBeVisible();

    await page.reload();
    await unlock(page, TEST_PASSPHRASE);
    const after = await openProfile(page, 0);
    await expect(after.getByRole('heading', { name: 'No documents linked yet' })).toBeVisible();
  });

  test('collapses a category so its links leave the page and the tab order', async ({
    unlockedApp: page,
  }) => {
    const documents = await openProfile(page, 0);
    await addLink(documents, 'Q3 promo packet', 'https://docs.google.com/d/1', 'Promo Packets');
    const toggle = documents.getByRole('button', { name: /Promo Packets/ });
    const link = documents.getByRole('link', { name: /Q3 promo packet/ });

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(link).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(link).toBeVisible();
  });
});

test.describe('document links on a phone', () => {
  test.use({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });

  test('stack the date under the title, always show the actions and fit the screen', async ({
    unlockedApp: page,
  }) => {
    await seedMembers(page, SEED_TEAM.slice(0, 1));
    const documents = await openProfile(page, 0);
    await addLink(
      documents,
      'A very long document title that has to wrap rather than push the page sideways',
      `https://wiki.example.com/${'segment/'.repeat(40)}`,
      'IDPs',
    );

    const row = documents.getByRole('listitem');
    await expect(row.getByRole('button', { name: /^Edit / })).toBeVisible();
    await expect(row.getByRole('button', { name: /^Remove / })).toBeVisible();
    const link = await row.getByRole('link').boundingBox();
    const date = await row.getByText('Updated today').boundingBox();
    expect(date?.y ?? 0).toBeGreaterThan((link?.y ?? 0) + (link?.height ?? 0) - 1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoViolations(page);
  });
});
