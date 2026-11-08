import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createMember, createNote, createReminder } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { toIsoDate } from '../utils/scheduleCalculator';
import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  it('puts the digest under the page heading, with a level 2 heading so the hierarchy has no gap', () => {
    renderWithProviders(<Dashboard />);

    const levels = screen.getAllByRole('heading').map((heading) => heading.tagName);
    expect(levels).toEqual(['H1', 'H2', 'H3', 'H3']);
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('No 1:1s scheduled today')).toBeInTheDocument();
  });

  it('shows who is overdue for a 1:1 under the digest', () => {
    const member = createMember({
      name: 'Alex Chen',
      schedule: { cadence: 'weekly', dayOfWeek: 'monday', time: '10:00', nextDate: '2030-01-07' },
    });
    const lastMet = new Date();
    lastMet.setDate(lastMet.getDate() - 20);

    renderWithProviders(<Dashboard />, {
      initialData: { members: [member] },
      initialPrivateData: {
        notes: [createNote({ memberId: member.id, createdAt: lastMet.toISOString() })],
      },
    });

    expect(screen.getByRole('region', { name: 'Overdue 1:1s' })).toHaveTextContent(
      'Last met 20 days ago',
    );
  });

  it('lists members stored with a 1:1 today', () => {
    const member = createMember({
      name: 'Alex Chen',
      schedule: {
        cadence: 'weekly',
        dayOfWeek: 'monday',
        time: '10:00',
        nextDate: toIsoDate(new Date()),
      },
    });

    renderWithProviders(<Dashboard />, { initialData: { members: [member] } });

    expect(screen.getByRole('link', { name: /Alex Chen/ })).toHaveAttribute(
      'href',
      `/person/${member.id}`,
    );
  });

  describe('reminders', () => {
    const today = toIsoDate(new Date());
    const alex = createMember({ id: 'alex', name: 'Alex Chen' });
    const renderWith = (...reminders: ReturnType<typeof createReminder>[]) =>
      renderWithProviders(<Dashboard />, {
        initialData: { members: [alex] },
        initialPrivateData: { reminders },
      });
    const dated = (overrides = {}) =>
      createReminder({
        linkedPersonId: 'alex',
        triggerType: 'specific_date',
        triggerDate: today,
        ...overrides,
      });

    it('shows a card for a reminder whose date is today, announced as a status', async () => {
      renderWith(dated({ text: 'Congratulate on the launch' }));

      const card = await screen.findByRole('region', { name: 'Reminders' });
      expect(within(card).getByRole('status')).toHaveTextContent('Congratulate on the launch');
      expect(within(card).getByRole('img', { name: 'Alex Chen' })).toBeInTheDocument();
    });

    it('shows nothing for reminders that are not due, dismissed or waiting for a 1:1', () => {
      renderWith(
        dated({ triggerDate: '2099-01-01' }),
        dated({ status: 'dismissed' }),
        createReminder({ linkedPersonId: 'alex' }),
      );

      expect(screen.queryByRole('region', { name: 'Reminders' })).not.toBeInTheDocument();
    });

    it('removes the card when its last reminder is dismissed', async () => {
      const user = userEvent.setup();
      renderWith(dated());

      await user.click(await screen.findByRole('button', { name: /^Dismiss reminder/ }));

      await waitFor(() =>
        expect(screen.queryByRole('region', { name: 'Reminders' })).not.toBeInTheDocument(),
      );
    });
  });
});
