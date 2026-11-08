import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { createMember, createReminder } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { DashboardReminders } from './DashboardReminders';

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
  renderWithProviders(<DashboardReminders now={NOW} />, {
    initialData: { members: members as never, settings },
    initialPrivateData: { dateEvents },
  });

const findCard = async () =>
  within(await screen.findByRole('region', { name: 'Reminders' })).getByRole('status');

const event = (type: string, date: string, engineerId = 'alex') => ({ engineerId, type, date });

describe('date reminders on the dashboard', () => {
  it('shows nothing when no date is near', () => {
    const { container } = renderReminders([event('visa_expiry', '2027-01-01')]);

    expect(container).toBeEmptyDOMElement();
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

  it('treats probation like visa: generic text, details on request, a different icon', async () => {
    const user = userEvent.setup();
    renderReminders([event('probation_end', '2026-06-29')], { settings: {} });

    const card = await findCard();
    expect(card).toHaveTextContent('Important date for Alex in 14 days');
    expect(card.querySelector('[data-icon="probation_end"] svg')).not.toBeNull();
    await user.click(within(card).getByRole('button', { name: /Show details/ }));
    expect(within(card).getByText('Probation end: Jun 29, 2026')).toBeInTheDocument();
  });

  it('shows an anniversary with its tenure, date and an italic conversation starter', async () => {
    renderReminders([], { members: [SAM] });

    const card = await findCard();
    expect(card).toHaveTextContent('Sam Lee · 2-year work anniversary');
    expect(card).toHaveTextContent('On Jun 20, 2026');
    expect(card.querySelector('[data-icon="anniversary"] svg')).not.toBeNull();
    const starter = card.querySelector('.date-reminder__starter');
    expect(starter).toHaveTextContent("Sam's 2-year anniversary is in 5 days");
  });

  it('shows a birthday today with a cake icon and no details button', async () => {
    renderReminders([event('birthday', '1990-06-15')]);

    const card = await findCard();
    expect(card).toHaveTextContent('Birthday: Alex Chen');
    expect(card).toHaveTextContent('Today');
    expect(card.querySelector('[data-icon="birthday"] svg')).not.toBeNull();
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('gives visa and probation cards no conversation starter', async () => {
    renderReminders([event('visa_expiry', '2026-06-20'), event('probation_end', '2026-06-20')]);

    await screen.findAllByRole('status');
    expect(document.querySelector('.date-reminder__starter')).toBeNull();
  });

  it('ignores a visa date that has already passed', () => {
    const { container } = renderReminders([event('visa_expiry', '2026-06-01')]);

    expect(container).toBeEmptyDOMElement();
  });

  it('follows a custom lead time from settings', async () => {
    renderReminders([event('probation_end', '2026-07-03')], {
      settings: { reminderLeadTimes: JSON.stringify({ probation_end: 21 }) },
    });

    expect(await findCard()).toHaveTextContent('in 18 days');
  });

  it('sits alongside contextual reminders in the same Reminders card', async () => {
    renderWithProviders(<DashboardReminders now={NOW} />, {
      initialData: { members: [ALEX] },
      initialPrivateData: {
        dateEvents: [event('birthday', '1990-06-15')],
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
    expect(within(card).getByText('Birthday: Alex Chen')).toBeInTheDocument();
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
