import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { getLeadTimeConfig } from '../data/dateEvents';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { LeadTimeSettings } from './LeadTimeSettings';

function CurrentConfig() {
  const storage = useEncryptedStorage();
  return <output aria-label="Config">{JSON.stringify(getLeadTimeConfig(storage))}</output>;
}

const renderSettings = (settings: Record<string, string> = {}) =>
  renderWithProviders(
    <>
      <LeadTimeSettings />
      <CurrentConfig />
    </>,
    { initialData: { settings } },
  );

const field = (name: string) => screen.getByRole('spinbutton', { name });

describe('LeadTimeSettings', () => {
  it('renders a section named Reminder Lead Times', () => {
    renderSettings();

    expect(screen.getByRole('region', { name: 'Reminder Lead Times' })).toBeInTheDocument();
  });

  it('starts at 30, 14, 7 and 1 days', () => {
    renderSettings();

    expect(field('Visa expiry')).toHaveValue(30);
    expect(field('Probation end')).toHaveValue(14);
    expect(field('Work anniversary')).toHaveValue(7);
    expect(field('Birthday')).toHaveValue(1);
  });

  it('shows saved lead times', () => {
    renderSettings({ reminderLeadTimes: JSON.stringify({ probation_end: 21 }) });

    expect(field('Probation end')).toHaveValue(21);
    expect(field('Visa expiry')).toHaveValue(30);
  });

  it('describes every input with the shared help text and limits it to 1 to 90', () => {
    renderSettings();

    for (const name of ['Visa expiry', 'Probation end', 'Work anniversary', 'Birthday']) {
      const input = field(name);
      expect(input).toHaveAccessibleDescription('Days before the date to show the reminder');
      expect(input).toHaveAttribute('min', '1');
      expect(input).toHaveAttribute('max', '90');
    }
  });

  it('saves a new lead time and says so', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.clear(field('Probation end'));
    await user.type(field('Probation end'), '21');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Lead times saved')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText('Config')).toHaveTextContent('"probation_end":21'),
    );
  });

  it.each(['0', '91', '', '2.5'])('refuses %j and keeps the saved value', async (value) => {
    const user = userEvent.setup();
    renderSettings();

    await user.clear(field('Birthday'));
    if (value) await user.type(field('Birthday'), value);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a whole number from 1 to 90');
    expect(field('Birthday')).toBeInvalid();
    expect(screen.getByLabelText('Config')).toHaveTextContent('"birthday":1');
    expect(screen.queryByText('Lead times saved')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderSettings();

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations with an error showing', async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    await user.clear(field('Birthday'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alert');

    expect(await axe(container)).toHaveNoViolations();
  });
});
