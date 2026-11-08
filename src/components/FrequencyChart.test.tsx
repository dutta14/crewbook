import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { WeeklyFrequency } from '../types/meeting';
import { FrequencyChart } from './FrequencyChart';

// Mondays, oldest first, ending 2026-11-02.
const weeks = (counts: number[]): WeeklyFrequency[] =>
  counts.map((count, index) => ({
    weekStart: new Date(2026, 10, 2 - (counts.length - 1 - index) * 7).toISOString().slice(0, 10),
    weekLabel: `W${index + 1}`,
    count,
  }));

const COUNTS = [0, 1, 0, 2, 1, 0, 0, 3, 1, 1, 0, 2];

describe('FrequencyChart', () => {
  it('describes itself as a twelve week meeting frequency image', () => {
    render(<FrequencyChart weeks={weeks(COUNTS)} />);

    expect(
      screen.getByRole('img', { name: 'Meeting frequency: last 12 weeks' }),
    ).toBeInTheDocument();
  });

  it('draws one bar per week and keeps them out of the accessibility tree', () => {
    render(<FrequencyChart weeks={weeks(COUNTS)} />);

    const bars = screen.getAllByTestId('frequency-bar');
    expect(bars).toHaveLength(12);
    bars.forEach((bar) => expect(bar).toHaveAttribute('aria-hidden', 'true'));
  });

  it('draws a thin baseline instead of a bar for weeks without meetings', () => {
    const { container } = render(<FrequencyChart weeks={weeks(COUNTS)} />);

    expect(container.querySelectorAll('.frequency-chart__baseline')).toHaveLength(5);
    expect(container.querySelectorAll('.frequency-chart__bar')).toHaveLength(7);
  });

  it('gives screen readers the same figures in a table', () => {
    render(<FrequencyChart weeks={weeks(COUNTS)} />);

    const table = screen.getByRole('table', { name: 'Meetings per week, last 12 weeks' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(13);
    expect(rows[8]).toHaveTextContent('3');
  });

  it('scales the axis to the busiest week', () => {
    render(<FrequencyChart weeks={weeks(COUNTS)} />);

    expect(screen.getByText('3', { selector: 'text' })).toBeInTheDocument();
    expect(screen.getByText('0', { selector: 'text' })).toBeInTheDocument();
  });

  it('still has a valid axis when every week is empty', () => {
    const { container } = render(<FrequencyChart weeks={weeks(Array(12).fill(0))} />);

    expect(screen.getByText('1', { selector: 'text' })).toBeInTheDocument();
    expect(container.querySelectorAll('.frequency-chart__baseline')).toHaveLength(12);
  });

  it('shows the week and meeting count in a tooltip on hover and hides it on leave', async () => {
    const user = userEvent.setup();
    render(<FrequencyChart weeks={weeks(COUNTS)} />);
    const bars = screen.getAllByTestId('frequency-bar');

    await user.hover(bars[7]);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^Week of \w{3} \d{1,2}: 3 meetings$/);

    await user.unhover(bars[7]);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('uses the singular for one meeting', async () => {
    const user = userEvent.setup();
    render(<FrequencyChart weeks={weeks(COUNTS)} />);

    await user.hover(screen.getAllByTestId('frequency-bar')[1]);

    expect(screen.getByRole('tooltip')).toHaveTextContent(/: 1 meeting$/);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<FrequencyChart weeks={weeks(COUNTS)} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
