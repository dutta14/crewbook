import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schedule } from '../types/Schedule';
import { ScheduleCard } from './ScheduleCard';

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';

const biweekly = (overrides: Partial<Schedule> = {}): Schedule => ({
  cadence: 'biweekly',
  dayOfWeek: 'tuesday',
  time: '10:00',
  nextDate: '2026-11-10',
  ...overrides,
});

function renderCard(schedule: Schedule | null = biweekly(), onSave = vi.fn()) {
  const result = render(<ScheduleCard memberId={MEMBER_ID} schedule={schedule} onSave={onSave} />);
  return { onSave, ...result };
}

beforeEach(() => {
  // Sunday 8 November 2026. Only Date is faked so user-event timers keep working.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 8, 12, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ScheduleCard', () => {
  it('displays schedule details (cadence, day, time, next date) on profile', () => {
    renderCard();

    const region = screen.getByRole('region', { name: '1:1 Schedule' });
    expect(region).toHaveTextContent('Every 2 weeks');
    expect(region).toHaveTextContent('Tuesdays at 10:00 AM');
    expect(region).toHaveTextContent('Tue, Nov 10, 2026');
    expect(screen.getByRole('heading', { level: 2, name: '1:1 Schedule' })).toBeInTheDocument();
  });

  it('formats afternoon and midnight times on a 12 hour clock', () => {
    renderCard(biweekly({ cadence: 'custom', customIntervalDays: 10, time: '00:05' }));

    expect(screen.getByText('Every 10 days')).toBeInTheDocument();
    expect(screen.getByText('Tuesdays at 12:05 AM')).toBeInTheDocument();
  });

  it('edit mode shows cadence/day/time inputs', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('button', { name: 'Edit 1:1 schedule' }));

    expect(screen.getByLabelText('Cadence')).toHaveValue('biweekly');
    expect(screen.getByLabelText('Day of week')).toHaveValue('tuesday');
    expect(screen.getByLabelText('Meeting time')).toHaveValue('10:00');
    expect(screen.queryByLabelText('Interval in days')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Day of week').querySelectorAll('option')).toHaveLength(5);
  });

  it('shows a labelled interval input only for the custom cadence', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: 'Edit 1:1 schedule' }));

    await user.selectOptions(screen.getByLabelText('Cadence'), 'custom');

    const interval = screen.getByLabelText('Interval in days');
    expect(interval).toHaveAttribute('min', '1');
    expect(interval).toHaveAttribute('inputmode', 'numeric');
    expect(interval).toHaveAttribute('type', 'number');
  });

  it('focus moves to cadence select when edit is clicked', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('button', { name: 'Edit 1:1 schedule' }));

    expect(screen.getByLabelText('Cadence')).toHaveFocus();
  });

  it('save returns focus to edit button and announces "Schedule saved" via aria-live', async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole('button', { name: 'Edit 1:1 schedule' }));
    await user.selectOptions(screen.getByLabelText('Day of week'), 'thursday');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Edit 1:1 schedule' })).toHaveFocus();
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Schedule saved');
  });

  it('cancel edit discards changes and returns focus to edit button', async () => {
    const user = userEvent.setup();
    const { onSave } = renderCard();
    await user.click(screen.getByRole('button', { name: 'Edit 1:1 schedule' }));
    await user.selectOptions(screen.getByLabelText('Cadence'), 'monthly');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit 1:1 schedule' })).toHaveFocus();
    expect(screen.getByText('Every 2 weeks')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('saves schedule to encrypted storage', async () => {
    const user = userEvent.setup();
    const { onSave } = renderCard(null);
    await user.click(screen.getByRole('button', { name: 'Set up schedule' }));
    await user.selectOptions(screen.getByLabelText('Cadence'), 'Biweekly');
    await user.selectOptions(screen.getByLabelText('Day of week'), 'Tuesday');
    fireEvent.change(screen.getByLabelText('Meeting time'), { target: { value: '10:00' } });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      cadence: 'biweekly',
      dayOfWeek: 'tuesday',
      time: '10:00',
      nextDate: '2026-11-10',
    });
  });

  it('saves a custom interval and omits it for other cadences', async () => {
    const user = userEvent.setup();
    const { onSave } = renderCard(null);
    await user.click(screen.getByRole('button', { name: 'Set up schedule' }));
    await user.selectOptions(screen.getByLabelText('Cadence'), 'custom');
    await user.clear(screen.getByLabelText('Interval in days'));
    await user.type(screen.getByLabelText('Interval in days'), '10');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ customIntervalDays: 10 }));
  });

  it('refuses to save an empty time or an invalid interval and says why', async () => {
    const user = userEvent.setup();
    const { onSave } = renderCard(null);
    await user.click(screen.getByRole('button', { name: 'Set up schedule' }));
    await user.selectOptions(screen.getByLabelText('Cadence'), 'custom');
    await user.clear(screen.getByLabelText('Interval in days'));
    await user.type(screen.getByLabelText('Interval in days'), '0');
    fireEvent.change(screen.getByLabelText('Meeting time'), { target: { value: '' } });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Meeting time')).toBeInvalid();
    expect(screen.getByLabelText('Meeting time')).toHaveAccessibleDescription(
      'Enter a meeting time',
    );
    expect(screen.getByLabelText('Interval in days')).toHaveAccessibleDescription(
      'Enter a whole number of days from 1 to 365',
    );
  });

  it('stays in edit mode with an alert when saving fails', async () => {
    const user = userEvent.setup();
    renderCard(biweekly(), vi.fn().mockRejectedValue(new Error('boom')));
    await user.click(screen.getByRole('button', { name: 'Edit 1:1 schedule' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save the schedule");
    expect(screen.getByLabelText('Cadence')).toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent('boom');
  });

  it('empty state renders "No 1:1 schedule set" with setup button', () => {
    renderCard(null);

    expect(screen.getByText('No 1:1 schedule set')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set up schedule' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip next 1:1' })).not.toBeInTheDocument();
  });

  it('starts a new schedule on the default cadence from Settings', async () => {
    const user = userEvent.setup();
    render(
      <ScheduleCard
        memberId={MEMBER_ID}
        schedule={null}
        defaultCadence="monthly"
        onSave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Set up schedule' }));

    expect(screen.getByLabelText('Cadence')).toHaveValue('monthly');
  });

  it('keeps a saved schedule on its own cadence whatever the default is', async () => {
    const user = userEvent.setup();
    render(
      <ScheduleCard
        memberId={MEMBER_ID}
        schedule={biweekly()}
        defaultCadence="monthly"
        onSave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit 1:1 schedule' }));

    expect(screen.getByLabelText('Cadence')).toHaveValue('biweekly');
  });

  it('cancelling the first setup returns focus to the setup button', async () => {
    const user = userEvent.setup();
    renderCard(null);
    await user.click(screen.getByRole('button', { name: 'Set up schedule' }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Set up schedule' })).toHaveFocus();
  });

  it('overdue date renders in red with visible "Overdue" text, not color alone', () => {
    renderCard(biweekly({ nextDate: '2026-11-03' }));

    const date = screen.getByText('Tue, Nov 3, 2026');
    expect(date.parentElement).toHaveClass('next-one-on-one--overdue');
    expect(screen.getByText('Overdue')).toBeVisible();
    expect(date.parentElement?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not mark a future or same-day 1:1 as overdue', () => {
    renderCard(biweekly({ nextDate: '2026-11-08' }));

    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
  });

  it('next date uses <time datetime> element', () => {
    renderCard();

    const time = screen.getByText('Tue, Nov 10, 2026');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', '2026-11-10');
  });

  it('skip next 1:1 saves the following occurrence and announces it', async () => {
    const user = userEvent.setup();
    const { onSave } = renderCard();

    await user.click(screen.getByRole('button', { name: 'Skip next 1:1' }));

    expect(onSave).toHaveBeenCalledWith(biweekly({ nextDate: '2026-11-24' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Next 1:1 skipped');
  });

  it('reschedule opens a labelled date input, saves a one-time override and returns focus', async () => {
    const user = userEvent.setup();
    const { onSave } = renderCard();
    await user.click(screen.getByRole('button', { name: 'Reschedule' }));

    const input = screen.getByLabelText('New date for next 1:1');
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('min', '2026-11-08');
    fireEvent.change(input, { target: { value: '2026-11-12' } });
    await user.click(screen.getByRole('button', { name: 'Confirm date' }));

    expect(onSave).toHaveBeenCalledWith(
      biweekly({ nextDate: '2026-11-12', overrideDate: '2026-11-12' }),
    );
    expect(await screen.findByRole('button', { name: 'Reschedule' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('1:1 rescheduled');
  });

  it('reschedule rejects a date in the past', async () => {
    const user = userEvent.setup();
    const { onSave } = renderCard();
    await user.click(screen.getByRole('button', { name: 'Reschedule' }));
    fireEvent.change(screen.getByLabelText('New date for next 1:1'), {
      target: { value: '2026-11-01' },
    });

    await user.click(screen.getByRole('button', { name: 'Confirm date' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New date for next 1:1')).toHaveAccessibleDescription(
      'Pick today or a later date',
    );
  });

  it('cancelling a reschedule returns focus to the reschedule button', async () => {
    const user = userEvent.setup();
    const { onSave } = renderCard();
    await user.click(screen.getByRole('button', { name: 'Reschedule' }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Reschedule' })).toHaveFocus();
  });

  it('has no axe violations in empty, display, overdue, edit and reschedule states', async () => {
    const user = userEvent.setup();
    const empty = renderCard(null);
    expect(await axe(empty.container)).toHaveNoViolations();
    empty.unmount();

    const overdue = renderCard(
      biweekly({ nextDate: '2026-11-03', cadence: 'custom', customIntervalDays: 9 }),
    );
    expect(await axe(overdue.container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Reschedule' }));
    expect(await axe(overdue.container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Edit 1:1 schedule' }));
    expect(await axe(overdue.container)).toHaveNoViolations();
  });
});
