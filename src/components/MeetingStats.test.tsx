import { render, screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import type { MeetingStats as MeetingStatsData } from '../types/meeting';
import { MeetingStats } from './MeetingStats';

const STATS: MeetingStatsData = {
  totalMeetings: 24,
  last30Days: 4,
  last90Days: 11,
  avgFrequencyDays: 7,
};

describe('MeetingStats', () => {
  it('pairs each figure with its label in a description list', () => {
    const { container } = render(<MeetingStats stats={STATS} />);

    const terms = Array.from(container.querySelectorAll('dt')).map((dt) => dt.textContent);
    const values = Array.from(container.querySelectorAll('dd')).map((dd) => dd.textContent);
    expect(terms).toEqual(['Total meetings', 'Last 30 days', 'Last 90 days', 'Avg frequency']);
    expect(values).toEqual(['24', '4', '11', 'Every 7 days']);
  });

  it('shows N/A for average frequency when there are fewer than two meetings', () => {
    const { container } = render(
      <MeetingStats stats={{ ...STATS, totalMeetings: 1, avgFrequencyDays: null }} />,
    );

    expect(within(container).getByText('N/A')).toBeInTheDocument();
  });

  it('shows zero rather than hiding a count when there are no meetings', () => {
    render(
      <MeetingStats
        stats={{ totalMeetings: 0, last30Days: 0, last90Days: 0, avgFrequencyDays: null }}
      />,
    );

    expect(screen.getAllByText('0')).toHaveLength(3);
  });

  it('says Every day when meetings happen daily', () => {
    render(<MeetingStats stats={{ ...STATS, avgFrequencyDays: 1 }} />);

    expect(screen.getByText('Every day')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<MeetingStats stats={STATS} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
