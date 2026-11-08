import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { Dashboard } from '../pages/Dashboard';
import { createMember, createReminder } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';

// Monday 15 June 2026.
const NOW = new Date(2026, 5, 15, 12);
const ALEX = createMember({ id: 'alex', name: 'Alex Chen', startDate: '2024-03-13' });
const SAM = createMember({ id: 'sam', name: 'Sam Lee', startDate: '2024-06-20' });

const renderReminders = (
  dateEvents: unknown[] = [],
  {
    members = [ALEX],
    settings = {},
  }: { members?: unknown[]; settings?: Record<string, string> } = {},
) =>
  renderWithProviders(<Dashboard now={NOW} />, {
    initialData: { members: members as never, settings },
    initialPrivateData: { dateEvents },
  });

const findCard = async () =>
  within(await screen.findByRole('region', { name: 'Reminders' })).getByRole('status');

const event = (type: string, date: string, engineerId = 'alex') => ({ engineerId, type, date });

describe('date reminders on the dashboard', () => {
  it('shows only the empty state when no date is near', async () => {
    renderReminders([event('visa_expiry', '2027-01-01')]);

    expect(await screen.findByText('All clear today.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Reminders' })).not.toBeInTheDocument();
  });

  it('shows a visa reminder with generic wording and a passport icon, hiding the date', async () => {
    renderReminders([event('visa_expiry', '2026-07-10')]);

    const card = await findCard();
    expect(card).toHaveTextContent('Important date for Alex in 25 days');
    expect(card.querySelector('[data-icon="visa_expiry"] svg')).not.toBeNull();
    expect(card).not.toHaveTextContent(/visa|Jul/i);
  });

  it('reveals the kind and date of a visa reminder only when asked, and hides them again', async () => {
    const user = userEvent.setup();
    renderReminders([event('visa_expiry', '2026-07-10')]);
    const toggle = await screen.findByRole('button', {
      name: "Show details for Alex's important date",
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(screen.getByText('Visa expiry: Jul 10, 2026')).toBeInTheDocument();
    const hide = screen.getByRole('button', { name: "Hide details for Alex's important date" });
    expect(hide).toHaveAttribute('aria-expanded', 'true');
    await user.click(hide);
    expect(screen.queryByText(/Visa expiry/)).not.toBeInTheDocument();
  });

  it('ignores a visa date that has already passed', async () => {
    renderReminders([event('visa_expiry', '2026-06-01')]);

    expect(await screen.findByText('All clear today.')).toBeInTheDocument();
  });

  it('treats probation like visa: generic text, details on request, a different icon', async () => {
    const user = userEvent.setup();
    renderReminders([event('probation_end', '2026-06-29')]);

    const card = await findCard();
    expect(card).toHaveTextContent('Important date for Alex in 14 days');
    expect(card.querySelector('[data-icon="probation_end"] svg')).not.toBeNull();
    await user.click(within(card).getByRole('button', { name: /Show details/ }));
    expect(within(card).getByText('Probation end: Jun 29, 2026')).toBeInTheDocument();
  });

  it('follows a custom lead time from settings', async () => {
    renderReminders([event('probation_end', '2026-07-03')], {
      settings: { reminderLeadTimes: JSON.stringify({ probation_end: 21 }) },
    });

    expect(await findCard()).toHaveTextContent('in 18 days');
  });

  it('lists an anniversary with its tenure, date and italic conversation starter', async () => {
    renderReminders([], { members: [SAM] });

    const section = await screen.findByRole('region', { name: 'Birthdays & Anniversaries' });
    expect(section).toHaveTextContent('Sam Lee');
    expect(section).toHaveTextContent('2-year anniversary');
    expect(section).toHaveTextContent('On Jun 20, 2026');
    expect(section.querySelector('.briefing-starter')).toHaveTextContent(
      "Sam's 2-year anniversary is in 5 days",
    );
  });

  it('lists a birthday today as a row that opens the profile', async () => {
    renderReminders([event('birthday', '1990-06-15')]);

    const section = await screen.findByRole('region', { name: 'Birthdays & Anniversaries' });
    const row = within(section).getByRole('link', { name: 'Alex Chen: Birthday, Today' });
    expect(row).toHaveAttribute('href', '/person/alex');
  });

  it('sits alongside contextual reminders in the same Reminders section', async () => {
    renderWithProviders(<Dashboard now={NOW} />, {
      initialData: { members: [ALEX] },
      initialPrivateData: {
        dateEvents: [event('visa_expiry', '2026-06-20')],
        reminders: [
          createReminder({
            text: 'Ask about on-call',
            triggerType: 'specific_date',
            triggerDate: '2026-06-15',
          }),
        ],
      },
    });

    const card = await screen.findByRole('region', { name: 'Reminders' });
    expect(await within(card).findByText('Ask about on-call')).toBeInTheDocument();
    expect(within(card).getByText('Important date for Alex in 5 days')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderReminders([
      event('visa_expiry', '2026-06-20'),
      event('birthday', '1990-06-15'),
    ]);
    await screen.findAllByRole('status');

    expect(await axe(container)).toHaveNoViolations();
  });
});
