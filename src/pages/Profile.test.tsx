import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { createActionItem, createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { TeamMember } from '../types/TeamMember';
import { Profile } from './Profile';

const ALEX = '11111111-1111-4111-8111-111111111111';
const PRIYA = '22222222-2222-4222-8222-222222222222';

function CurrentUrl() {
  const { pathname } = useLocation();
  return <output aria-label="Current URL">{pathname}</output>;
}

const team = (): TeamMember[] => [
  createMember({
    id: ALEX,
    name: 'Alex Chen',
    role: 'Software Engineer',
    level: 'L4',
    status: 'active',
    startDate: '2023-03-13',
    email: 'alex.chen@example.com',
    manager: PRIYA,
    customFields: { Team: 'Payments' },
    createdAt: '2024-01-01T12:00:00.000Z',
    history: [
      {
        id: 'h2',
        date: '2024-03-01T12:00:00.000Z',
        field: 'status',
        from: 'on_leave',
        to: 'active',
      },
      {
        id: 'h1',
        date: '2024-02-01T12:00:00.000Z',
        field: 'status',
        from: 'active',
        to: 'on_leave',
      },
    ],
  }),
  createMember({ id: PRIYA, name: 'Priya Nair', role: 'Engineering Manager', level: 'L6' }),
];

function renderProfile(id: string, members: TeamMember[] = team()) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/roster" element={<h1>Roster page</h1>} />
        <Route path="/person/:id" element={<Profile />} />
      </Routes>
      <CurrentUrl />
    </>,
    { route: `/person/${id}`, initialData: { members } },
  );
}

describe('Profile', () => {
  it('Overview tab shows all member fields', () => {
    renderProfile(ALEX);

    const overview = screen.getByRole('tabpanel', { name: 'Overview' });
    const fields = within(overview);
    expect(fields.getByText('Software Engineer')).toBeInTheDocument();
    expect(fields.getByText('L4')).toBeInTheDocument();
    expect(fields.getByText('Active')).toBeInTheDocument();
    expect(fields.getByText('Mar 13, 2023')).toBeInTheDocument();
    expect(fields.getByRole('link', { name: 'alex.chen@example.com' })).toBeInTheDocument();
    expect(fields.getByText('Team')).toBeInTheDocument();
    expect(fields.getByText('Payments')).toBeInTheDocument();
  });

  it('manager field links to manager profile', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX);

    await user.click(screen.getByRole('link', { name: 'Priya Nair' }));

    expect(screen.getByLabelText('Current URL')).toHaveTextContent(`/person/${PRIYA}`);
    expect(screen.getByRole('heading', { level: 1, name: 'Priya Nair' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('moves focus to the name heading on arrival', () => {
    renderProfile(ALEX);

    expect(screen.getByRole('heading', { level: 1, name: 'Alex Chen' })).toHaveFocus();
  });

  it('Timeline tab shows status change entries chronologically', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX);

    await user.click(screen.getByRole('tab', { name: 'Timeline' }));

    const items = within(screen.getByRole('list', { name: 'Activity timeline' })).getAllByRole(
      'listitem',
    );
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Added to team'),
      expect.stringContaining('Status changed from Active to On Leave'),
      expect.stringContaining('Status changed from On Leave to Active'),
    ]);
    expect(within(items[1]).getByText(/2024/)).toHaveAttribute(
      'datetime',
      '2024-02-01T12:00:00.000Z',
    );
  });

  it('timeline with no entries shows empty state', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX, [createMember({ id: ALEX, createdAt: 'unknown' })]);

    await user.click(screen.getByRole('tab', { name: 'Timeline' }));

    expect(screen.getByText('No activity recorded yet')).toBeInTheDocument();
  });

  it('Edit button opens pre-filled edit modal', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX);

    await user.click(screen.getByRole('button', { name: "Edit Alex Chen's profile" }));

    const dialog = await screen.findByRole('dialog', { name: 'Edit Team Member' });
    expect(within(dialog).getByLabelText(/Name/)).toHaveValue('Alex Chen');
    expect(within(dialog).getByLabelText('Role')).toHaveValue('Software Engineer');
    expect(within(dialog).getByLabelText('Manager')).toHaveValue(PRIYA);
  });

  it('saving an edit updates the header, records it in the timeline and shows a toast', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX);
    await user.click(screen.getByRole('button', { name: "Edit Alex Chen's profile" }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Team Member' });

    await user.clear(within(dialog).getByLabelText('Role'));
    await user.type(within(dialog).getByLabelText('Role'), 'Staff Engineer');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Alex Chen updated')).toBeInTheDocument();
    expect(screen.getByText('Staff Engineer · L4')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Timeline' }));
    expect(screen.getByText('Role changed to Staff Engineer')).toBeInTheDocument();
  });

  it('does not offer the member as their own manager when editing', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX);
    await user.click(screen.getByRole('button', { name: "Edit Alex Chen's profile" }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Team Member' });

    const options = within(within(dialog).getByLabelText('Manager')).getAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual(['None', 'Priya Nair']);
  });

  it('after edit modal closes, focus returns to Edit button', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX);
    const edit = screen.getByRole('button', { name: "Edit Alex Chen's profile" });
    await user.click(edit);
    const dialog = await screen.findByRole('dialog', { name: 'Edit Team Member' });

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(edit).toHaveFocus());
  });

  it('back link navigates to roster', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX);

    await user.click(screen.getByRole('link', { name: 'Team' }));

    expect(screen.getByRole('heading', { name: 'Roster page' })).toBeInTheDocument();
  });

  it('back link arrow is decorative (aria-hidden)', () => {
    renderProfile(ALEX);

    const back = screen.getByRole('link', { name: 'Team' });
    expect(back).toHaveTextContent('← Team');
    expect(back.querySelector('[aria-hidden="true"]')).toHaveTextContent('←');
  });

  it.each([
    ['an id nobody has', '33333333-3333-4333-8333-333333333333'],
    ['an id that is not a UUID', 'nonexistent-id'],
    ['a path traversal attempt', '..%2F..%2Fetc'],
  ])('invalid ID renders 404 state for %s', (_label, id) => {
    renderProfile(id);

    expect(screen.getByRole('heading', { level: 1, name: 'Person not found' })).toBeInTheDocument();
    expect(screen.queryByText(id)).not.toBeInTheDocument();
  });

  it('404 state moves focus to heading and its button returns to the roster', async () => {
    const user = userEvent.setup();
    renderProfile('nonexistent-id');

    expect(screen.getByRole('heading', { name: 'Person not found' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Back to team' }));

    expect(screen.getByRole('heading', { name: 'Roster page' })).toBeInTheDocument();
  });

  it('tabs switch content on click', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX);

    await user.click(screen.getByRole('tab', { name: 'Notes' }));
    expect(
      await within(screen.getByRole('tabpanel', { name: 'Notes' })).findByRole('button', {
        name: 'Save Note',
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Goals' }));
    expect(screen.getByRole('tabpanel', { name: 'Goals' })).toHaveTextContent('Goals are coming');
  });

  it('tabs use role="tablist" and role="tab" with aria-selected', () => {
    renderProfile(ALEX);

    const tablist = screen.getByRole('tablist');
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Overview', 'Notes', 'Goals', 'Timeline']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
  });

  it('Left/Right arrow keys switch between tabs', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX);
    screen.getByRole('tab', { name: 'Overview' }).focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });

  it('profile with missing optional fields renders gracefully', () => {
    renderProfile(ALEX, [
      createMember({
        id: ALEX,
        name: 'Sam Lee',
        role: '',
        level: '',
        email: '',
        manager: null,
        customFields: undefined as never,
      }),
    ]);

    expect(screen.getByRole('heading', { level: 1, name: 'Sam Lee' })).toBeInTheDocument();
    const overview = screen.getByRole('tabpanel', { name: 'Overview' });
    expect(within(overview).getAllByText('Not set')).toHaveLength(4);
  });

  it('renders freeform custom field content as text, not markup', () => {
    renderProfile(ALEX, [
      createMember({ id: ALEX, customFields: { Notes: '&lt;b&gt;bold&lt;/b&gt;' } }),
    ]);

    expect(screen.getByText('&lt;b&gt;bold&lt;/b&gt;')).toBeInTheDocument();
  });

  it('never puts the member name in the page title', () => {
    renderProfile(ALEX);

    expect(document.title).not.toContain('Alex');
  });

  it('asks for confirmation before deleting, then removes the member and returns to the roster', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX);

    await user.click(screen.getByRole('button', { name: 'Delete Alex Chen' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Alex Chen?' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Alex Chen' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Alex Chen' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    expect(await screen.findByRole('heading', { name: 'Roster page' })).toBeInTheDocument();
    expect(screen.getByText('Alex Chen removed from your team')).toBeInTheDocument();
  });

  it('deleting a member also purges their action items but keeps everyone else’s', async () => {
    const user = userEvent.setup();
    function RemainingItems() {
      const { getPrivate } = useEncryptedStorage();
      const items = getPrivate<Array<{ title: string }>>('actionItems') ?? [];
      return <output aria-label="Remaining items">{items.map((i) => i.title).join(',')}</output>;
    }
    renderWithProviders(
      <>
        <Routes>
          <Route path="/roster" element={<h1>Roster page</h1>} />
          <Route path="/person/:id" element={<Profile />} />
        </Routes>
        <RemainingItems />
      </>,
      {
        route: `/person/${ALEX}`,
        initialData: { members: team() },
        initialPrivateData: {
          actionItems: [
            createActionItem({ memberId: ALEX, title: 'Alex item' }),
            createActionItem({ memberId: PRIYA, title: 'Priya item' }),
          ],
        },
      },
    );

    await user.click(screen.getByRole('button', { name: 'Delete Alex Chen' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Remaining items' })).toHaveTextContent(
        /^Priya item$/,
      ),
    );
  });

  it('shows the 1:1 schedule card below the header and saves a new schedule through storage', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX);

    expect(screen.getByText('No 1:1 schedule set')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Set up schedule' }));
    await user.selectOptions(screen.getByLabelText('Cadence'), 'Biweekly');
    await user.selectOptions(screen.getByLabelText('Day of week'), 'Tuesday');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const card = await screen.findByRole('region', { name: '1:1 Schedule' });
    expect(within(card).getByText('Every 2 weeks')).toBeInTheDocument();
    expect(within(card).getByText('Tuesdays at 10:00 AM')).toBeInTheDocument();
    expect(await within(card).findByRole('button', { name: 'Edit 1:1 schedule' })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Overview' })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderProfile(ALEX);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations in the 404 state', async () => {
    const { container } = renderProfile('nonexistent-id');

    expect(await axe(container)).toHaveNoViolations();
  });
});
