import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';
import {
  SEED_TEAM,
  seedConnections,
  seedId,
  seedMembers,
  type SeedConnection,
} from './fixtures/seedMembers';

const NAMES = SEED_TEAM.map((member) => member.name);

const expectNoViolations = async (page: Page) => {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations).toEqual([]);
};

const openConnectionsTab = async (page: Page, memberIndex: number) => {
  await page.evaluate((id) => window.location.assign(`#/person/${id}`), seedId(memberIndex));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('tab', { name: 'Connections' }).click();
  const panel = page.getByRole('tabpanel', { name: 'Connections' });
  await expect(panel.getByRole('heading', { name: 'Connections', level: 2 })).toBeVisible();
  return panel;
};

const openFromSidebar = async (page: Page, link: string, heading: string) => {
  await page.getByRole('link', { name: link }).click();
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
};

test.describe('peer connections', () => {
  test.beforeEach(async ({ unlockedApp: page }) => {
    await seedMembers(page, SEED_TEAM);
  });

  test('a connection added on one profile appears on the peer’s profile with the relationship turned around', async ({
    unlockedApp: page,
  }) => {
    const alice = await openConnectionsTab(page, 0);
    await expect(alice.getByRole('heading', { name: 'No connections yet' })).toBeVisible();
    await expectNoViolations(page);

    await alice.getByRole('button', { name: 'Add connection' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add connection' });
    await dialog.getByRole('combobox', { name: /Peer name/ }).fill('bob');
    await dialog.getByRole('option', { name: /Bob Singh/ }).click();
    await dialog.getByLabel('Relationship type').selectOption({ label: 'Mentor' });
    await dialog.getByLabel('Notes (optional)').fill('Reviews my design docs');
    await expectNoViolations(page);
    await dialog.getByRole('button', { name: 'Save Connection' }).click();
    await expect(dialog).toHaveCount(0);

    const aliceRow = alice.getByRole('listitem').filter({ hasText: 'Bob Singh' });
    await expect(aliceRow).toContainText('Mentor');
    await expect(aliceRow).toContainText('Reviews my design docs');

    const bob = await openConnectionsTab(page, 1);
    const bobRow = bob.getByRole('listitem').filter({ hasText: 'Alice Park' });
    await expect(bobRow).toContainText('Mentee');
    await expectNoViolations(page);
  });

  test('removing a connection from one profile removes it from the other', async ({
    unlockedApp: page,
  }) => {
    await seedConnections(
      page,
      [{ sourceIndex: 0, target: 1, relationship: 'collaborator' }],
      NAMES,
    );

    const bob = await openConnectionsTab(page, 1);
    await expect(bob.getByText('Alice Park')).toBeVisible();

    const alice = await openConnectionsTab(page, 0);
    await alice.getByRole('button', { name: 'Remove connection with Bob Singh' }).click();
    await page
      .getByRole('alertdialog', { name: 'Remove connection?' })
      .getByRole('button', { name: 'Remove' })
      .click();
    await expect(alice.getByRole('heading', { name: 'No connections yet' })).toBeVisible();

    const bobAgain = await openConnectionsTab(page, 1);
    await expect(bobAgain.getByRole('heading', { name: 'No connections yet' })).toBeVisible();
  });

  test('a cross-team peer who is not on the team is shown with an initials avatar', async ({
    unlockedApp: page,
  }) => {
    const alice = await openConnectionsTab(page, 0);

    await alice.getByRole('button', { name: 'Add connection' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add connection' });
    await dialog.getByRole('combobox', { name: /Peer name/ }).fill('Jo Rivera');
    await dialog.getByRole('option', { name: /Add "Jo Rivera" as cross-team peer/ }).click();
    await dialog.getByLabel('Relationship type').selectOption({ label: 'Stakeholder' });
    await dialog.getByRole('button', { name: 'Save Connection' }).click();

    const row = alice.getByRole('listitem').filter({ hasText: 'Jo Rivera' });
    await expect(row).toContainText('Stakeholder');
    await expect(row.getByText('JR', { exact: true })).toBeVisible();
    await expect(row.getByRole('link')).toHaveCount(0);
  });

  test('selecting a node on the network graph dims unrelated people and the background restores them', async ({
    unlockedApp: page,
  }) => {
    const connections: SeedConnection[] = [
      { sourceIndex: 0, target: 1, relationship: 'collaborator' },
      { sourceIndex: 1, target: 2, relationship: 'mentor' },
      { sourceIndex: 3, target: 'Jo Rivera', relationship: 'stakeholder' },
    ];
    await seedConnections(page, connections, NAMES);

    await openFromSidebar(page, 'Network', 'Network');
    await expect(page.getByText('Contains sensitive relationship data')).toBeVisible();
    const graph = page.getByRole('img', { name: 'Team connection network graph' });
    await expect(graph).toBeVisible();
    await expect(page.getByTestId(/^graph-node-/)).toHaveCount(4);
    await expectNoViolations(page);

    await page.getByTestId(`graph-node-${seedId(0)}`).click();
    await expect(page.getByTestId(`graph-node-${seedId(0)}`)).toHaveAttribute(
      'data-selected',
      'true',
    );
    await expect(page.getByTestId(`graph-node-${seedId(1)}`)).not.toHaveAttribute('data-dimmed');
    await expect(page.getByTestId(`graph-node-${seedId(2)}`)).toHaveAttribute(
      'data-dimmed',
      'true',
    );
    await expect(page.getByTestId(`graph-node-${seedId(3)}`)).toHaveAttribute(
      'data-dimmed',
      'true',
    );

    await page.getByTestId('graph-background').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('[data-dimmed]')).toHaveCount(0);

    await page.getByText('Show connections as a list').click();
    await expect(page.getByText('Jo Rivera')).toBeVisible();
  });

  test('360 planning pre-checks collaborators and stakeholders and counts the reviewers', async ({
    unlockedApp: page,
  }) => {
    await seedConnections(
      page,
      [
        { sourceIndex: 0, target: 1, relationship: 'collaborator' },
        { sourceIndex: 0, target: 2, relationship: 'collaborator' },
        { sourceIndex: 0, target: 3, relationship: 'mentor' },
        { sourceIndex: 0, target: 'Jo Rivera', relationship: 'stakeholder' },
      ],
      NAMES,
    );

    await openFromSidebar(page, '360 Planning', '360 Planning');
    await expect(page.getByLabel('Select team member')).toHaveValue('');
    await page.getByLabel('Select team member').selectOption({ label: 'Alice Park' });

    await expect(
      page.getByRole('checkbox', { name: 'Include Bob Singh as reviewer' }),
    ).toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: 'Include Carmen Diaz as reviewer' }),
    ).toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: 'Include Jo Rivera as reviewer' }),
    ).toBeChecked();
    const mentor = page.getByRole('checkbox', { name: 'Include Dev Patel as reviewer' });
    await expect(mentor).not.toBeChecked();
    await expect(page.getByText('3 reviewers selected')).toBeVisible();
    await expect(
      page.getByText('Reviewer selections are not shared with team members'),
    ).toBeVisible();
    await expectNoViolations(page);

    await mentor.check();
    await expect(page.getByText('4 reviewers selected')).toBeVisible();
  });
});
