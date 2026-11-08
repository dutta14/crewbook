import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import {
  createActionItem,
  createDecision,
  createFollowUp,
  createGrowthEntry,
  createLeave,
  createMember,
  createMoodEntry,
  createNote,
  createReminder,
  createTodo,
} from '../test-utils/factories';
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

function renderWithProfileNotes(id: string, notes: ReturnType<typeof createNote>[], search = '') {
  return renderWithProviders(
    <Routes>
      <Route path="/person/:id" element={<Profile />} />
    </Routes>,
    {
      route: `/person/${id}${search}`,
      initialData: { members: team() },
      initialPrivateData: { notes },
    },
  );
}

// Skips live mode's 250ms close animation, as users who prefer reduced motion do.
const reduceMotion = () =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );

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
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Notes',
      'Meetings',
      'Decisions & Follow-ups',
      'Goals',
      'Growth',
      'Timeline',
    ]);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false',
      'false',
      'false',
    ]);
  });

  it('Meetings tab shows stats, the 12 week chart and the meeting history', async () => {
    const user = userEvent.setup();
    const notes = [
      createNote({
        memberId: ALEX,
        content: 'Talked through the launch plan',
        createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      }),
      createNote({
        memberId: ALEX,
        createdAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
      }),
    ];
    renderWithProfileNotes(ALEX, notes);

    await user.click(screen.getByRole('tab', { name: 'Meetings' }));

    const panel = screen.getByRole('tabpanel', { name: 'Meetings' });
    expect(within(panel).getByText('Total meetings').nextElementSibling).toHaveTextContent('2');
    expect(
      within(panel).getByRole('img', { name: 'Meeting frequency: last 12 weeks' }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole('link', { name: /Talked through the launch plan/ }),
    ).toBeVisible();
  });

  it('opens the Notes tab on the note named in the link', async () => {
    const note = createNote({
      memberId: ALEX,
      content: 'Career conversation',
      createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
    renderWithProfileNotes(ALEX, [note], `?note=${note.id}`);

    const panel = await screen.findByRole('tabpanel', { name: 'Notes' });
    expect(screen.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true');
    const item = await within(panel).findByText('Career conversation');
    await waitFor(() => expect(item.closest('li')).toHaveFocus());
  });

  it('still opens the Notes tab when the linked note no longer exists', () => {
    renderWithProfileNotes(ALEX, [], '?note=missing');

    expect(screen.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true');
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

  it('Arrow keys move between Goals, Growth and Timeline', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX);
    screen.getByRole('tab', { name: 'Goals' }).focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Growth' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('heading', { name: 'Growth' })).toBeInTheDocument();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Timeline' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Goals' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows only the member’s own growth entries on the Growth tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/person/:id" element={<Profile />} />
      </Routes>,
      {
        route: `/person/${ALEX}`,
        initialData: { members: team() },
        initialPrivateData: {
          growth: [
            createGrowthEntry({ engineerId: ALEX, to: 'L5' }),
            createGrowthEntry({ engineerId: PRIYA, to: 'L9' }),
          ],
        },
      },
    );

    await user.click(screen.getByRole('tab', { name: 'Growth' }));

    const panel = await screen.findByRole('tabpanel', { name: 'Growth' });
    expect(await within(panel).findByText('L4 → L5')).toBeInTheDocument();
    expect(within(panel).queryByText(/L9/)).toBeNull();
  });

  it('deleting a member also purges their growth entries but keeps everyone else’s', async () => {
    const user = userEvent.setup();
    function Remaining() {
      const { getPrivate } = useEncryptedStorage();
      const growth = getPrivate<Array<{ engineerId: string; to: string }>>('growth') ?? [];
      return (
        <output aria-label="Remaining growth">
          {growth.map((entry) => `${entry.engineerId}:${entry.to}`).join(',')}
        </output>
      );
    }
    renderWithProviders(
      <>
        <Routes>
          <Route path="/roster" element={<h1>Roster page</h1>} />
          <Route path="/person/:id" element={<Profile />} />
        </Routes>
        <Remaining />
      </>,
      {
        route: `/person/${ALEX}`,
        initialData: { members: team() },
        initialPrivateData: {
          growth: [
            createGrowthEntry({ engineerId: ALEX, to: 'L5' }),
            createGrowthEntry({ engineerId: PRIYA, to: 'L7' }),
          ],
        },
      },
    );

    await user.click(screen.getByRole('button', { name: 'Delete Alex Chen' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Remaining growth' })).toHaveTextContent(
        `${PRIYA}:L7`,
      ),
    );
    expect(screen.getByRole('status', { name: 'Remaining growth' })).not.toHaveTextContent(ALEX);
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
    const keyDates = within(overview).getByRole('region', { name: 'Key Dates' });
    expect(within(keyDates).getAllByText('Not set')).toHaveLength(3);
    expect(within(overview).getAllByText('Not set')).toHaveLength(7);
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

  it('deleting a member also purges their decisions and follow-ups but keeps everyone else’s', async () => {
    const user = userEvent.setup();
    function Remaining() {
      const { getPrivate } = useEncryptedStorage();
      const decisions = getPrivate<Array<{ title: string }>>('decisions') ?? [];
      const followUps = getPrivate<Array<{ title: string }>>('followUps') ?? [];
      return (
        <output aria-label="Remaining records">
          {[...decisions, ...followUps].map((i) => i.title).join(',')}
        </output>
      );
    }
    renderWithProviders(
      <>
        <Routes>
          <Route path="/roster" element={<h1>Roster page</h1>} />
          <Route path="/person/:id" element={<Profile />} />
        </Routes>
        <Remaining />
      </>,
      {
        route: `/person/${ALEX}`,
        initialData: { members: team() },
        initialPrivateData: {
          decisions: [
            createDecision({ engineerId: ALEX, title: 'Alex decision' }),
            createDecision({ engineerId: PRIYA, title: 'Priya decision' }),
          ],
          followUps: [
            createFollowUp({ engineerId: ALEX, title: 'Alex follow-up' }),
            createFollowUp({ engineerId: PRIYA, title: 'Priya follow-up' }),
          ],
        },
      },
    );

    await user.click(screen.getByRole('button', { name: 'Delete Alex Chen' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Remaining records' })).toHaveTextContent(
        /^Priya decision,Priya follow-up$/,
      ),
    );
  });

  it('shows the member’s decisions and follow-ups on their tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/person/:id" element={<Profile />} />
      </Routes>,
      {
        route: `/person/${ALEX}`,
        initialData: { members: team() },
        initialPrivateData: {
          decisions: [
            createDecision({ engineerId: ALEX, title: 'Alex decision' }),
            createDecision({ engineerId: PRIYA, title: 'Priya decision' }),
          ],
          followUps: [createFollowUp({ engineerId: ALEX, title: 'Alex follow-up' })],
        },
      },
    );

    await user.click(screen.getByRole('tab', { name: 'Decisions & Follow-ups' }));

    const panel = await screen.findByRole('tabpanel', { name: 'Decisions & Follow-ups' });
    expect(
      await within(panel).findByRole('article', { name: 'Decision: Alex decision' }),
    ).toBeVisible();
    expect(within(panel).getByRole('article', { name: 'Follow-up: Alex follow-up' })).toBeVisible();
    expect(within(panel).queryByText('Priya decision')).not.toBeInTheDocument();
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

  it('deleting a member also purges tasks linked to them but keeps the rest', async () => {
    const user = userEvent.setup();
    function RemainingTodos() {
      const { getPrivate } = useEncryptedStorage();
      const todos = getPrivate<Array<{ title: string }>>('todos') ?? [];
      return <output aria-label="Remaining tasks">{todos.map((t) => t.title).join(',')}</output>;
    }
    renderWithProviders(
      <>
        <Routes>
          <Route path="/roster" element={<h1>Roster page</h1>} />
          <Route path="/person/:id" element={<Profile />} />
        </Routes>
        <RemainingTodos />
      </>,
      {
        route: `/person/${ALEX}`,
        initialData: { members: team() },
        initialPrivateData: {
          todos: [
            createTodo({ title: 'About Alex', linkedPersonId: ALEX }),
            createTodo({ title: 'About Priya', linkedPersonId: PRIYA }),
            createTodo({ title: 'Unlinked' }),
          ],
        },
      },
    );

    await user.click(screen.getByRole('button', { name: 'Delete Alex Chen' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Remaining tasks' })).toHaveTextContent(
        /^About Priya,Unlinked$/,
      ),
    );
  });

  it("deleting a member also purges their leave but keeps everyone else's", async () => {
    const user = userEvent.setup();
    function RemainingLeave() {
      const { getPrivate } = useEncryptedStorage();
      const entries = getPrivate<Array<{ memberId: string }>>('leave') ?? [];
      return (
        <output aria-label="Remaining leave">{entries.map((e) => e.memberId).join(',')}</output>
      );
    }
    renderWithProviders(
      <>
        <Routes>
          <Route path="/roster" element={<h1>Roster page</h1>} />
          <Route path="/person/:id" element={<Profile />} />
        </Routes>
        <RemainingLeave />
      </>,
      {
        route: `/person/${ALEX}`,
        initialData: { members: team() },
        initialPrivateData: {
          leave: [
            createLeave({ memberId: ALEX, type: 'sick' }),
            createLeave({ memberId: PRIYA }),
            createLeave({ memberId: ALEX }),
          ],
        },
      },
    );

    await user.click(screen.getByRole('button', { name: 'Delete Alex Chen' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Remaining leave' })).toHaveTextContent(
        new RegExp(`^${PRIYA}$`),
      ),
    );
  });

  it('deleting a member also purges reminders about them but keeps the rest', async () => {
    const user = userEvent.setup();
    function RemainingReminders() {
      const { getPrivate } = useEncryptedStorage();
      const reminders = getPrivate<Array<{ text: string }>>('reminders') ?? [];
      return (
        <output aria-label="Remaining reminders">{reminders.map((r) => r.text).join(',')}</output>
      );
    }
    renderWithProviders(
      <>
        <Routes>
          <Route path="/roster" element={<h1>Roster page</h1>} />
          <Route path="/person/:id" element={<Profile />} />
        </Routes>
        <RemainingReminders />
      </>,
      {
        route: `/person/${ALEX}`,
        initialData: { members: team() },
        initialPrivateData: {
          reminders: [
            createReminder({ text: 'About Alex', linkedPersonId: ALEX }),
            createReminder({ text: 'About Priya', linkedPersonId: PRIYA }),
          ],
        },
      },
    );

    await user.click(screen.getByRole('button', { name: 'Delete Alex Chen' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Remaining reminders' })).toHaveTextContent(
        /^About Priya$/,
      ),
    );
  });

  it('deleting a member also purges their key dates but keeps everyone else’s', async () => {
    const user = userEvent.setup();
    function RemainingDates() {
      const { getPrivate } = useEncryptedStorage();
      const dates = getPrivate<Array<{ engineerId: string }>>('dateEvents') ?? [];
      return (
        <output aria-label="Remaining dates">
          {dates.map((d) => (d.engineerId === ALEX ? 'alex' : 'priya')).join(',')}
        </output>
      );
    }
    renderWithProviders(
      <>
        <Routes>
          <Route path="/roster" element={<h1>Roster page</h1>} />
          <Route path="/person/:id" element={<Profile />} />
        </Routes>
        <RemainingDates />
      </>,
      {
        route: `/person/${ALEX}`,
        initialData: { members: team() },
        initialPrivateData: {
          dateEvents: [
            { engineerId: ALEX, type: 'visa_expiry', date: '2030-01-01' },
            { engineerId: PRIYA, type: 'visa_expiry', date: '2030-01-01' },
          ],
        },
      },
    );

    await user.click(screen.getByRole('button', { name: 'Delete Alex Chen' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Remaining dates' })).toHaveTextContent(/^priya$/),
    );
  });

  it('shows the Key Dates section on the Overview tab', () => {
    renderProfile(ALEX);

    expect(screen.getByRole('region', { name: 'Key Dates' })).toBeInTheDocument();
  });

  it('adds a reminder from the profile and lists it under Reminders', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX);

    await user.click(screen.getByRole('button', { name: 'Add reminder for Alex Chen' }));
    const dialog = screen.getByRole('dialog', { name: 'New Reminder' });
    expect(within(dialog).getByLabelText('Linked person')).toHaveValue('Alex Chen');
    await user.type(within(dialog).getByRole('textbox', { name: /Reminder/ }), 'Ask about on-call');
    await user.click(within(dialog).getByRole('button', { name: 'Save reminder' }));

    expect(await screen.findByText('Reminder saved')).toBeInTheDocument();
    const list = screen.getByRole('region', { name: 'Reminders' });
    expect(await within(list).findByText('Ask about on-call')).toBeInTheDocument();
  });

  it('deleting a member also purges their mood ratings but keeps everyone else’s', async () => {
    const user = userEvent.setup();
    function RemainingMoods() {
      const { getPrivate } = useEncryptedStorage();
      const moods = getPrivate<Array<{ memberId: string }>>('moods') ?? [];
      return <output aria-label="Remaining moods">{moods.map((m) => m.memberId).join(',')}</output>;
    }
    renderWithProviders(
      <>
        <Routes>
          <Route path="/roster" element={<h1>Roster page</h1>} />
          <Route path="/person/:id" element={<Profile />} />
        </Routes>
        <RemainingMoods />
      </>,
      {
        route: `/person/${ALEX}`,
        initialData: { members: team() },
        initialPrivateData: {
          moods: [createMoodEntry({ memberId: ALEX }), createMoodEntry({ memberId: PRIYA })],
        },
      },
    );

    await user.click(screen.getByRole('button', { name: 'Delete Alex Chen' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Remaining moods' })).toHaveTextContent(
        new RegExp(`^${PRIYA}$`),
      ),
    );
  });

  it('shows the private energy trend only after the manager opts in', () => {
    const { unmount } = renderProfile(ALEX);
    expect(screen.queryByRole('heading', { name: /Energy trend/ })).not.toBeInTheDocument();
    unmount();

    renderWithProviders(
      <Routes>
        <Route path="/person/:id" element={<Profile />} />
      </Routes>,
      {
        route: `/person/${ALEX}`,
        initialData: { members: team(), settings: { moodTrackingEnabled: 'true' } },
      },
    );

    expect(screen.getByRole('heading', { name: 'Energy trend (private)' })).toBeInTheDocument();
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

  it('starts live mode from the header and shows it as a dialog over the profile', async () => {
    const user = userEvent.setup();
    renderProfile(ALEX);

    await user.click(screen.getByRole('button', { name: 'Start 1:1' }));

    expect(screen.getByRole('dialog', { name: '1:1 with Alex Chen' })).toBeInTheDocument();
  });

  it('after End 1:1, saves the note and offers the mood prompt when tracking is on', async () => {
    reduceMotion();
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/person/:id" element={<Profile />} />
      </Routes>,
      {
        route: `/person/${ALEX}`,
        initialData: {
          members: team(),
          settings: { moodTrackingEnabled: 'true', liveModeNoticeDismissed: 'true' },
        },
      },
    );
    await user.click(screen.getByRole('button', { name: 'Start 1:1' }));
    await user.type(screen.getByRole('textbox', { name: '1:1 notes' }), 'Great chat');
    await user.click(screen.getByRole('button', { name: 'End 1:1 meeting and save' }));

    const rating = await screen.findByRole('region', { name: 'Rate this 1:1' });
    expect(within(rating).getByRole('radio', { name: 'Good energy' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Notes' }));
    expect(
      within(screen.getByRole('tabpanel', { name: 'Notes' })).getByText('Great chat'),
    ).toBeInTheDocument();
  });

  it('shows the prep card above the tabs once there is an earlier 1:1, and not while live', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/person/:id" element={<Profile />} />
      </Routes>,
      {
        route: `/person/${ALEX}`,
        initialData: { members: team(), settings: { liveModeNoticeDismissed: 'true' } },
        initialPrivateData: {
          notes: [
            createNote({
              memberId: ALEX,
              content: 'Talked about the launch',
              createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            }),
          ],
        },
      },
    );

    const prep = await screen.findByRole('region', { name: 'PREP' });
    expect(within(prep).getByText('Talked about the launch')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start 1:1' }));
    const dialog = screen.getByRole('dialog', { name: '1:1 with Alex Chen' });
    expect(screen.getAllByRole('region', { name: 'PREP' })).toHaveLength(1);
    expect(within(dialog).getByRole('region', { name: 'PREP' })).toBeInTheDocument();
  });

  it('does not ask for a mood after End 1:1 when tracking is off', async () => {
    reduceMotion();
    const user = userEvent.setup();
    renderProfile(ALEX);
    await user.click(screen.getByRole('button', { name: 'Start 1:1' }));
    await user.click(screen.getByRole('button', { name: 'End 1:1 meeting and save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('region', { name: 'Rate this 1:1' })).not.toBeInTheDocument();
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
