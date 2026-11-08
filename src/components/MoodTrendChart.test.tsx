import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { createMoodEntry } from '../test-utils/factories';
import type { MoodEntry, MoodScore } from '../types/MoodEntry';
import { MoodTrendChart } from './MoodTrendChart';

const entries = (scores: MoodScore[]): MoodEntry[] =>
  scores.map((score, index) =>
    createMoodEntry({
      score,
      recordedAt: new Date(Date.UTC(2025, 0, 1 + index * 7, 12)).toISOString(),
    }),
  );

describe('MoodTrendChart', () => {
  it('shows an empty state instead of a chart when there is no data', () => {
    render(<MoodTrendChart entries={[]} />);

    expect(screen.getByText('No mood data recorded yet')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('describes the trend on the SVG', () => {
    render(<MoodTrendChart entries={entries([3, 4, 5])} />);

    expect(screen.getByRole('img', { name: 'Energy trend over last 3 sessions' })).toBeVisible();
  });

  it('provides a Date and Mood table for screen readers', () => {
    render(<MoodTrendChart entries={entries([2, 5])} />);

    const table = screen.getByRole('table');
    expect(table).toHaveClass('sr-only');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Date', 'Mood']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Jan 1, 2025');
    expect(rows[0]).toHaveTextContent('Low energy');
    expect(rows[1]).toHaveTextContent('Great energy');
  });

  it('draws one dot per entry', () => {
    render(<MoodTrendChart entries={entries([1, 2, 3, 4, 5])} />);

    expect(screen.getAllByTestId('mood-dot')).toHaveLength(5);
  });

  it('draws a single dot and no line for one entry', () => {
    const { container } = render(<MoodTrendChart entries={entries([4])} />);

    expect(screen.getAllByTestId('mood-dot')).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Energy trend over last 1 session' })).toBeVisible();
    expect(container.querySelector('.mood-chart__line')).toBeNull();
  });

  it('joins consecutive entries with line segments', () => {
    const { container } = render(<MoodTrendChart entries={entries([1, 3, 5])} />);

    expect(container.querySelectorAll('.mood-chart__line')).toHaveLength(2);
  });

  it('plots exactly 12 entries', () => {
    render(<MoodTrendChart entries={entries([1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2])} />);

    expect(screen.getAllByTestId('mood-dot')).toHaveLength(12);
  });

  it('only plots the most recent 12 of a longer history', () => {
    render(<MoodTrendChart entries={entries(Array.from({ length: 15 }, () => 3 as MoodScore))} />);

    expect(screen.getAllByTestId('mood-dot')).toHaveLength(12);
    expect(screen.getByRole('img', { name: 'Energy trend over last 12 sessions' })).toBeVisible();
  });

  it('labels only some dates when points are crowded', () => {
    const { container } = render(<MoodTrendChart entries={entries(Array(12).fill(3))} />);

    expect(container.querySelectorAll('.mood-chart__label')).toHaveLength(4);
  });

  it('shows the date and emoji in a tooltip while hovering a dot', async () => {
    const user = userEvent.setup();
    render(<MoodTrendChart entries={entries([2, 5])} />);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.hover(screen.getAllByTestId('mood-dot')[1]);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Jan 8, 2025');
    expect(tooltip).toHaveTextContent('😊');
    await user.unhover(screen.getAllByTestId('mood-dot')[1]);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps the dots hidden from assistive technology', () => {
    render(<MoodTrendChart entries={entries([3])} />);

    expect(screen.getByTestId('mood-dot')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<MoodTrendChart entries={entries([1, 3, 5])} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
