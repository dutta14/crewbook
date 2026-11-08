import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createGrowthEntry, createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { GrowthTimeline } from './GrowthTimeline';

const ALEX = createMember({
  id: 'alex',
  name: 'Alex Chen',
  role: 'Software Engineer',
  level: 'L4',
});

const seeded = () => [
  createGrowthEntry({
    engineerId: ALEX.id,
    date: '2023-01-10',
    changeType: 'team_transfer',
    from: 'Payments',
    to: 'Platform',
    notes: '',
  }),
  createGrowthEntry({
    engineerId: ALEX.id,
    date: '2025-03-03',
    changeType: 'promotion',
    from: 'L4',
    to: 'L5',
    notes: 'Led the payments migration.',
  }),
  createGrowthEntry({
    engineerId: ALEX.id,
    date: '2024-06-01',
    changeType: 'title_update',
    from: 'Engineer',
    to: 'Software Engineer',
    notes: '',
  }),
];

function renderTimeline(growth: unknown[] = seeded()) {
  return renderWithProviders(<GrowthTimeline member={ALEX} />, {
    initialData: { members: [ALEX] },
    initialPrivateData: { growth },
  });
}

const fillDate = (value: string) =>
  fireEvent.change(screen.getByLabelText(/^Date/), { target: { value } });

describe('GrowthTimeline', () => {
  it('renders the entries newest first in an ordered list', () => {
    renderTimeline();

    const list = screen.getByRole('list', { name: 'Growth timeline' });
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.querySelector('time')?.textContent)).toEqual([
      'Mar 3, 2025',
      'Jun 1, 2024',
      'Jan 10, 2023',
    ]);
  });

  it('shows each entry’s date, change type, from, to and notes', () => {
    renderTimeline();

    const promotion = within(screen.getAllByRole('listitem')[0]);
    expect(promotion.getByText('Mar 3, 2025')).toBeInTheDocument();
    expect(promotion.getByText('Promotion')).toBeInTheDocument();
    expect(promotion.getByText('L4 → L5')).toBeInTheDocument();
    expect(promotion.getByText('Led the payments migration.')).toBeInTheDocument();
  });

  it('tags each change type so it can be coloured', () => {
    renderTimeline();

    expect(screen.getByText('Promotion')).toHaveAttribute('data-change-type', 'promotion');
    expect(screen.getByText('Title update')).toHaveAttribute('data-change-type', 'title_update');
    expect(screen.getByText('Team transfer')).toHaveAttribute('data-change-type', 'team_transfer');
  });

  it('shows notes as plain text, never as markup', () => {
    renderTimeline([
      createGrowthEntry({ engineerId: ALEX.id, notes: '<img src=x onerror=alert(1)> **bold**' }),
    ]);

    expect(screen.getByText('<img src=x onerror=alert(1)> **bold**')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('hides the decorative nodes and connector lines from assistive technology', () => {
    const { container } = renderTimeline();

    const decorations = container.querySelectorAll('.growth-entry__node, .growth-entry__line');
    expect(decorations).toHaveLength(6);
    decorations.forEach((element) => expect(element).toHaveAttribute('aria-hidden', 'true'));
  });

  it('derives the current level from the latest entry, ignoring team transfers', () => {
    renderTimeline([
      ...seeded(),
      createGrowthEntry({
        engineerId: ALEX.id,
        date: '2025-09-01',
        changeType: 'team_transfer',
        to: 'Growth',
      }),
    ]);

    expect(screen.getByText('Current level / role').nextSibling).toHaveTextContent('L5');
  });

  it('shows the profile level and role when there are no entries', () => {
    renderTimeline([]);

    expect(screen.getByText('Current level / role').nextSibling).toHaveTextContent(
      'L4 · Software Engineer',
    );
  });

  it('shows an empty state with a call to action, and no export', async () => {
    const user = userEvent.setup();
    renderTimeline([]);

    expect(screen.getByRole('heading', { name: 'No growth entries yet' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export growth history as text' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Growth timeline' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Add first entry' }));
    expect(await screen.findByRole('dialog', { name: 'Add growth entry' })).toBeInTheDocument();
  });

  it('ignores other people’s entries', () => {
    renderTimeline([
      ...seeded(),
      createGrowthEntry({ engineerId: 'someone-else', to: 'L9', date: '2026-01-01' }),
    ]);

    expect(screen.queryByText('L9')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('opens an empty form from Add entry', async () => {
    const user = userEvent.setup();
    renderTimeline();

    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    const dialog = await screen.findByRole('dialog', { name: 'Add growth entry' });
    expect(within(dialog).getByLabelText(/^Date/)).toHaveValue('');
    expect(within(dialog).getByLabelText('From')).toHaveValue('');
    expect(within(dialog).queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('appends a new entry in date order when the add form is saved', async () => {
    const user = userEvent.setup();
    renderTimeline();

    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add growth entry' });
    fillDate('2025-08-15');
    await user.selectOptions(within(dialog).getByLabelText('Change type'), 'role_change');
    await user.type(within(dialog).getByLabelText('From'), 'Software Engineer');
    await user.type(within(dialog).getByLabelText('To'), 'Tech Lead');
    await user.type(within(dialog).getByLabelText('Notes'), 'Took over the team');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(within(items[0]).getByText('Aug 15, 2025')).toBeInTheDocument();
    expect(within(items[0]).getByText('Role change')).toBeInTheDocument();
    expect(within(items[0]).getByText('Software Engineer → Tech Lead')).toBeInTheDocument();
    expect(within(items[0]).getByText('Took over the team')).toBeInTheDocument();
    expect(screen.getByText('Current level / role').nextSibling).toHaveTextContent('Tech Lead');
  });

  it('opens the edit form pre-filled and updates the entry in place', async () => {
    const user = userEvent.setup();
    renderTimeline();

    await user.click(
      screen.getByRole('button', { name: 'Edit promotion entry from March 3, 2025' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit growth entry' });
    expect(within(dialog).getByLabelText(/^Date/)).toHaveValue('2025-03-03');
    expect(within(dialog).getByLabelText('Change type')).toHaveValue('promotion');
    expect(within(dialog).getByLabelText('From')).toHaveValue('L4');
    expect(within(dialog).getByLabelText('To')).toHaveValue('L5');
    expect(within(dialog).getByLabelText('Notes')).toHaveValue('Led the payments migration.');

    await user.clear(within(dialog).getByLabelText('From'));
    await user.type(within(dialog).getByLabelText('From'), 'L3');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText('L3 → L5')).toBeInTheDocument();
  });

  it('removes the entry only after the delete is confirmed', async () => {
    const user = userEvent.setup();
    renderTimeline();

    await user.click(
      screen.getByRole('button', { name: 'Edit promotion entry from March 3, 2025' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit growth entry' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    const confirm = await screen.findByRole('alertdialog');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(screen.queryByText('Mar 3, 2025')).toBeNull();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Growth' })).toHaveFocus();
  });

  it('keeps the entry when the delete confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderTimeline();

    await user.click(
      screen.getByRole('button', { name: 'Edit promotion entry from March 3, 2025' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit growth entry' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('dialog', { name: 'Edit growth entry' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toHaveFocus();
  });

  it('copies a plain-text summary and confirms without echoing it', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderTimeline();

    await user.click(screen.getByRole('button', { name: 'Export growth history as text' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const text = String(writeText.mock.calls[0][0]);
    expect(text).toContain('Growth history: Alex Chen');
    expect(text).toContain('Mar 3, 2025 - Promotion: L4 -> L5');
    expect(text.indexOf('Jan 10, 2023')).toBeLessThan(text.indexOf('Mar 3, 2025'));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Copied to clipboard');
    expect(status).not.toHaveTextContent('L5');
  });

  it('says so when the copy fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    renderTimeline();

    await user.click(screen.getByRole('button', { name: 'Export growth history as text' }));

    expect(await screen.findByText('Copy failed. Try again.')).toBeInTheDocument();
    expect(screen.queryByText('Copied to clipboard')).toBeNull();
  });

  it('has no accessibility violations with entries and with the form open', async () => {
    const user = userEvent.setup();
    const { container } = renderTimeline();
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add growth entry' });
    expect(await axe(dialog)).toHaveNoViolations();
  });

  it('has no accessibility violations when empty', async () => {
    const { container } = renderTimeline([]);

    expect(await axe(container)).toHaveNoViolations();
  });
});
