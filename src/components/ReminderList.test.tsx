import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { createMember, createReminder } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { Reminder } from '../types/reminder';
import { ReminderList } from './ReminderList';

// Monday 15 June 2026.
const NOW = new Date(2026, 5, 15, 12);
const ALEX = createMember({
  id: 'alex',
  name: 'Alex Chen',
  schedule: { cadence: 'weekly', dayOfWeek: 'thursday', time: '10:00', nextDate: '2026-06-18' },
});
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

const forAlex = (overrides: Partial<Reminder> = {}) =>
  createReminder({ linkedPersonId: 'alex', linkedPersonName: 'Alex Chen', ...overrides });

const renderList = (reminders: Reminder[] = [], person = ALEX) =>
  renderWithProviders(<ReminderList person={person} now={NOW} />, {
    initialData: { members: [ALEX, PRIYA] },
    initialPrivateData: { reminders },
  });

describe('ReminderList', () => {
  it('shows an empty hint when nothing has been set', () => {
    renderList();

    expect(screen.getByRole('heading', { level: 3, name: 'Reminders' })).toBeInTheDocument();
    expect(
      screen.getByText('Nothing to bring up yet. Add a reminder to raise it at the next 1:1.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Past reminders' })).not.toBeInTheDocument();
  });

  it('lists the active reminders for this person only', async () => {
    renderList([
      forAlex({ text: 'First thing' }),
      forAlex({ text: 'Second thing' }),
      createReminder({ linkedPersonId: 'priya', text: 'Priya only' }),
    ]);

    const section = await screen.findByRole('region', { name: 'Reminders' });
    expect(within(section).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText('Priya only')).not.toBeInTheDocument();
  });

  it('keeps a snoozed reminder in the list and says until when', () => {
    renderList([forAlex({ status: 'snoozed', snoozedUntil: '2026-06-22', text: 'Later' })]);

    expect(screen.getByText('Later')).toBeInTheDocument();
    expect(screen.getByText('Snoozed until Mon, Jun 22, 2026')).toBeInTheDocument();
  });

  it('shows dismissed reminders under their own heading, below a divider, without actions', () => {
    renderList([
      forAlex({ text: 'Still open' }),
      forAlex({
        text: 'Done already',
        status: 'dismissed',
        dismissedAt: new Date(2026, 5, 10, 9).toISOString(),
      }),
    ]);

    const past = screen.getByRole('region', { name: 'Past reminders' });
    expect(within(past).getByText('Done already')).toBeInTheDocument();
    expect(within(past).getByText('Dismissed Wed, Jun 10, 2026')).toBeInTheDocument();
    expect(within(past).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Reminders' }).querySelector('.reminder-card--past'),
    ).not.toBeNull();
  });

  it('removes a reminder from the DOM once it is dismissed and moves it to past reminders', async () => {
    const user = userEvent.setup();
    renderList([forAlex({ text: 'Bring this up' })]);

    await user.click(screen.getByRole('button', { name: /^Dismiss reminder/ }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Dismiss reminder/ })).not.toBeInTheDocument(),
    );
    const past = screen.getByRole('region', { name: 'Past reminders' });
    expect(within(past).getByText('Bring this up')).toBeInTheDocument();
  });

  it('snoozes a reminder and keeps it visible with the new date', async () => {
    const user = userEvent.setup();
    renderList([forAlex({ text: 'Check in' })]);

    await user.click(screen.getByRole('button', { name: 'Snooze' }));
    await user.click(screen.getByRole('menuitem', { name: '1 week' }));

    expect(await screen.findByText(/^Snoozed until /)).toBeInTheDocument();
    expect(screen.getByText('Check in')).toBeInTheDocument();
  });

  it('tells the manager when "next 1:1" fell back to a week', async () => {
    const user = userEvent.setup();
    renderList([createReminder({ linkedPersonId: 'priya', text: 'No schedule' })], PRIYA);

    await user.click(screen.getByRole('button', { name: 'Snooze' }));
    await user.click(screen.getByRole('menuitem', { name: 'Next 1:1' }));

    expect(
      await screen.findByText('No 1:1 is scheduled, so the reminder is snoozed for a week.'),
    ).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderList([
      forAlex(),
      forAlex({ status: 'dismissed', dismissedAt: NOW.toISOString() }),
    ]);

    expect(await axe(container)).toHaveNoViolations();
  });
});
