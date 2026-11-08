import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { createLeave, createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { LeaveEntry } from '../types/leave';
import { addDays, formatLongDay } from '../utils/calendarDates';
import { toIsoDate } from '../utils/scheduleCalculator';
import { Calendar } from './Calendar';

const ALEX = createMember({ id: '11111111-1111-4111-8111-111111111111', name: 'Alex Chen' });
const PRIYA = createMember({ id: '22222222-2222-4222-8222-222222222222', name: 'Priya Nair' });
const TODAY = toIsoDate(new Date());

function StoredLeave() {
  const { getPrivate } = useEncryptedStorage();
  const entries = getPrivate<LeaveEntry[]>('leave') ?? [];
  return (
    <output aria-label="Stored leave">
      {entries.map((entry) => `${entry.memberId}:${entry.type}:${entry.startDate}`).join(',')}
    </output>
  );
}

const renderCalendar = (entries: LeaveEntry[] = []) =>
  renderWithProviders(
    <>
      <Calendar />
      <StoredLeave />
    </>,
    { initialData: { members: [ALEX, PRIYA] }, initialPrivateData: { leave: entries } },
  );

describe('Calendar page', () => {
  it('shows the heading, moves focus to it, and defaults to the month view', async () => {
    renderCalendar();

    const heading = screen.getByRole('heading', { level: 1, name: 'PTO Calendar' });
    expect(heading).toHaveFocus();
    expect(await screen.findByRole('tab', { name: 'Month' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: '+ Add leave' })).toBeInTheDocument();
  });

  it('shows saved leave on the grid', async () => {
    renderCalendar([
      createLeave({ memberId: ALEX.id, type: 'sick', startDate: TODAY, endDate: TODAY }),
    ]);

    const cell = await screen.findByRole('gridcell', { name: formatLongDay(TODAY) });
    expect(within(cell).getByRole('button', { name: /Alex Chen, Sick/ })).toBeInTheDocument();
  });

  it('explains when there is no one to schedule', async () => {
    renderWithProviders(<Calendar />);

    expect(await screen.findByText('No one to schedule yet')).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('adds leave from the header button and shows it right away', async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(await screen.findByRole('button', { name: '+ Add leave' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add Leave' });
    await user.selectOptions(within(dialog).getByLabelText(/Person/), 'Priya Nair');
    await user.selectOptions(within(dialog).getByLabelText('Type'), 'Personal');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('status', { name: 'Stored leave' })).toHaveTextContent(
      `${PRIYA.id}:personal:${TODAY}`,
    );
    expect(await screen.findAllByRole('button', { name: /Priya Nair, Personal/ })).not.toHaveLength(
      0,
    );
  });

  it('opens a pre-filled form from a chip and saves the changes', async () => {
    const user = userEvent.setup();
    renderCalendar([
      createLeave({ memberId: ALEX.id, type: 'pto', startDate: TODAY, endDate: TODAY }),
    ]);

    await user.click(await screen.findByRole('button', { name: /Alex Chen, PTO/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Leave' });
    expect(within(dialog).getByLabelText(/Person/)).toHaveValue(ALEX.id);
    await user.selectOptions(within(dialog).getByLabelText('Type'), 'Sick');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Stored leave' })).toHaveTextContent(
        `${ALEX.id}:sick:${TODAY}`,
      ),
    );
  });

  it('asks before deleting, and returns focus to the grid afterwards', async () => {
    const user = userEvent.setup();
    renderCalendar([createLeave({ memberId: ALEX.id, startDate: TODAY, endDate: TODAY })]);

    await user.click(await screen.findByRole('button', { name: /Alex Chen, PTO/ }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Edit Leave' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete leave?' });
    expect(confirm).toHaveAccessibleDescription(/Alex Chen/);
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Stored leave' })).toHaveTextContent(/^$/),
    );
    await waitFor(() =>
      expect(screen.getByRole('gridcell', { name: formatLongDay(TODAY) })).toHaveFocus(),
    );
    expect(screen.queryByRole('button', { name: /Alex Chen, PTO/ })).not.toBeInTheDocument();
  });

  it('keeps the leave when the delete is cancelled', async () => {
    const user = userEvent.setup();
    renderCalendar([createLeave({ memberId: ALEX.id, startDate: TODAY, endDate: TODAY })]);

    await user.click(await screen.findByRole('button', { name: /Alex Chen, PTO/ }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Edit Leave' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByRole('status', { name: 'Stored leave' })).toHaveTextContent(ALEX.id);
  });

  it('pre-fills a new leave with the day the calendar is on', async () => {
    const user = userEvent.setup();
    renderCalendar();

    await user.click(await screen.findByRole('tab', { name: 'Week' }));
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    await user.click(screen.getByRole('button', { name: '+ Add leave' }));

    expect(await screen.findByLabelText(/Start/)).toHaveValue(addDays(TODAY, 7));
  });

  it('has no accessibility violations', async () => {
    const { container } = renderCalendar([
      createLeave({ memberId: ALEX.id, startDate: TODAY, endDate: TODAY }),
      createLeave({ memberId: PRIYA.id, type: 'sick', startDate: TODAY, endDate: TODAY }),
    ]);
    await screen.findByRole('grid');

    expect(await axe(container)).toHaveNoViolations();
  });
});
