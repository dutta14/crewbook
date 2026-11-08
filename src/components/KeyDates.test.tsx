import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { KeyDates } from './KeyDates';

// Monday 15 June 2026.
const NOW = new Date(2026, 5, 15, 12);
const ALEX = createMember({ id: 'alex', name: 'Alex Chen', startDate: '2024-06-18' });

const renderDates = (dateEvents: unknown[] = [], member = ALEX) =>
  renderWithProviders(<KeyDates member={member} now={NOW} />, {
    initialData: { members: [member] },
    initialPrivateData: { dateEvents },
  });

const visa = (date = '2026-07-01') => ({ engineerId: 'alex', type: 'visa_expiry', date });
const probation = (date = '2026-08-01') => ({ engineerId: 'alex', type: 'probation_end', date });
const birthday = (date = '1990-03-15') => ({ engineerId: 'alex', type: 'birthday', date });

describe('KeyDates', () => {
  it('renders as a section named by its heading', () => {
    renderDates();

    const section = screen.getByRole('region', { name: 'Key Dates' });
    expect(within(section).getByRole('heading', { level: 3, name: 'Key Dates' })).toHaveAttribute(
      'id',
      'key-dates-heading',
    );
  });

  it('offers a Not set button named for each date that has no value', () => {
    renderDates();

    for (const name of ['Set Visa expiry', 'Set Probation end', 'Set Birthday']) {
      expect(screen.getByRole('button', { name })).toHaveTextContent('Not set');
    }
    expect(screen.queryByRole('button', { name: 'Set Work anniversary' })).not.toBeInTheDocument();
  });

  it('opens a labelled date input that skips autofill when Not set is clicked', async () => {
    const user = userEvent.setup();
    renderDates();

    await user.click(screen.getByRole('button', { name: 'Set Visa expiry' }));

    const input = screen.getByLabelText('Visa expiry');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveFocus();
  });

  it('works out the work anniversary from the start date and shows it as read-only text', () => {
    renderDates();

    const anniversary = screen.getByRole('group', {
      name: 'Work anniversary: Jun 18, 2026, auto-calculated',
    });
    expect(anniversary).toHaveTextContent('Jun 18, 2026');
    expect(anniversary).toHaveTextContent('auto');
    expect(within(anniversary).queryByRole('button')).not.toBeInTheDocument();
  });

  it('follows the start date when it changes', () => {
    renderDates([], createMember({ id: 'alex', startDate: '2020-12-01' }));

    expect(screen.getByRole('group', { name: /^Work anniversary: Dec 1, 2026/ })).toBeVisible();
  });

  it('saves a new visa expiry and shows it formatted as Mon DD, YYYY', async () => {
    const user = userEvent.setup();
    renderDates();

    await user.click(screen.getByRole('button', { name: 'Set Visa expiry' }));
    fireEvent.change(screen.getByLabelText('Visa expiry'), { target: { value: '2026-07-01' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Jul 1, 2026')).toBeInTheDocument();
    expect(screen.queryByLabelText('Visa expiry')).not.toBeInTheDocument();
    expect(screen.getByText('Visa expiry saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Visa expiry' })).toHaveFocus();
  });

  it('edits an existing date, starting from its current value', async () => {
    const user = userEvent.setup();
    renderDates([birthday()]);

    await user.click(screen.getByRole('button', { name: 'Edit Birthday' }));
    expect(screen.getByLabelText('Birthday')).toHaveValue('1990-03-15');
    fireEvent.change(screen.getByLabelText('Birthday'), { target: { value: '1991-04-16' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Apr 16, 1991')).toBeInTheDocument();
  });

  it('clears a date and goes back to Not set', async () => {
    const user = userEvent.setup();
    renderDates([birthday()]);

    await user.click(screen.getByRole('button', { name: 'Edit Birthday' }));
    await user.click(screen.getByRole('button', { name: 'Clear Birthday' }));

    expect(await screen.findByRole('button', { name: 'Set Birthday' })).toHaveFocus();
    expect(screen.getByText('Birthday cleared')).toBeInTheDocument();
  });

  it('cancels without saving and returns focus to the field', async () => {
    const user = userEvent.setup();
    renderDates();

    await user.click(screen.getByRole('button', { name: 'Set Birthday' }));
    fireEvent.change(screen.getByLabelText('Birthday'), { target: { value: '1990-03-15' } });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Set Birthday' })).toHaveFocus();
    expect(screen.queryByText('Mar 15, 1990')).not.toBeInTheDocument();
  });

  it('asks for a date when Save is pressed with nothing chosen', async () => {
    const user = userEvent.setup();
    renderDates();

    await user.click(screen.getByRole('button', { name: 'Set Visa expiry' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const input = screen.getByLabelText('Visa expiry');
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a date');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Choose a date');
  });

  it('explains why a date was refused without repeating it', async () => {
    const user = userEvent.setup();
    renderDates();

    await user.click(screen.getByRole('button', { name: 'Set Birthday' }));
    fireEvent.change(screen.getByLabelText('Birthday'), { target: { value: '2026-06-16' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Birthday must be in the past');
    expect(screen.getByLabelText('Birthday')).toBeInTheDocument();
  });

  describe('sensitive dates', () => {
    it('masks visa and probation dates until the manager asks to see them', async () => {
      const user = userEvent.setup();
      renderDates([visa(), probation(), birthday()]);

      expect(screen.queryByText('Jul 1, 2026')).not.toBeInTheDocument();
      expect(screen.queryByText('Aug 1, 2026')).not.toBeInTheDocument();
      expect(screen.getByText('Mar 15, 1990')).toBeInTheDocument();
      expect(screen.getAllByText('Hidden')).toHaveLength(2);

      await user.click(screen.getByRole('button', { name: 'Show sensitive dates' }));

      expect(screen.getByText('Jul 1, 2026')).toBeInTheDocument();
      expect(screen.getByText('Aug 1, 2026')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Hide sensitive dates' }));
      expect(screen.queryByText('Jul 1, 2026')).not.toBeInTheDocument();
    });

    it('has no reveal button when there is nothing sensitive to reveal', () => {
      renderDates([birthday()]);

      expect(screen.queryByRole('button', { name: /sensitive dates/ })).not.toBeInTheDocument();
    });

    it('shows the dates when one is opened for editing, since the current value is shown', async () => {
      const user = userEvent.setup();
      renderDates([visa()]);

      await user.click(screen.getByRole('button', { name: 'Edit Visa expiry' }));

      expect(screen.getByLabelText('Visa expiry')).toHaveValue('2026-07-01');
    });

    it('hides them again after leaving the profile', async () => {
      const user = userEvent.setup();
      const { unmount } = renderDates([visa()]);
      await user.click(screen.getByRole('button', { name: 'Show sensitive dates' }));
      unmount();

      renderDates([visa()]);

      expect(screen.queryByText('Jul 1, 2026')).not.toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = renderDates([visa(), birthday()]);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations while editing', async () => {
    const user = userEvent.setup();
    const { container } = renderDates();
    await user.click(screen.getByRole('button', { name: 'Set Visa expiry' }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
