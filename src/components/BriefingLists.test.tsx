import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { BriefingCelebration, BriefingLeave } from '../types/briefing';
import { BriefingCelebrations } from './BriefingCelebrations';
import { BriefingEmptyState } from './BriefingEmptyState';
import { BriefingOnLeave } from './BriefingOnLeave';

const routed = (element: React.ReactElement) =>
  renderWithProviders(
    <Routes>
      <Route path="/" element={element} />
      <Route path="/person/:id" element={<p>Profile page</p>} />
    </Routes>,
  );

const birthday: BriefingCelebration = {
  engineerId: 'alex',
  name: 'Alex Chen',
  eventType: 'birthday',
  eventLabel: 'Birthday',
  timing: 'Today',
};
const anniversary: BriefingCelebration = {
  engineerId: 'sam',
  name: 'Sam Lee',
  eventType: 'anniversary',
  eventLabel: '2-year anniversary',
  timing: 'On Jun 20, 2026',
  conversationStarter: 'Ask what they are proudest of.',
};
const away: BriefingLeave = { engineerId: 'kai', name: 'Kai Mori', leaveType: 'Away' };

describe('BriefingCelebrations', () => {
  it('lists each celebration with its label, timing and conversation starter', async () => {
    const user = userEvent.setup();
    routed(<BriefingCelebrations celebrations={[birthday, anniversary]} members={[]} />);

    const section = screen.getByRole('region', { name: 'Birthdays & Anniversaries' });
    const row = within(section).getByRole('link', {
      name: 'Sam Lee: 2-year anniversary, On Jun 20, 2026',
    });
    expect(within(section).getByText('Ask what they are proudest of.')).toBeInTheDocument();
    expect(within(section).getAllByRole('listitem')).toHaveLength(2);
    await user.click(row);

    expect(screen.getByText('Profile page')).toBeInTheDocument();
  });

  it('says so when there is nothing to celebrate', () => {
    routed(<BriefingCelebrations celebrations={[]} members={[]} />);

    expect(screen.getByText('No birthdays or anniversaries coming up')).toBeInTheDocument();
  });
});

describe('BriefingOnLeave', () => {
  it('lists who is away by a generic label', () => {
    routed(<BriefingOnLeave people={[away]} members={[]} />);

    expect(screen.getByRole('link', { name: 'Kai Mori, Away' })).toHaveAttribute(
      'href',
      '/person/kai',
    );
  });

  it('says so when nobody is away', () => {
    routed(<BriefingOnLeave people={[]} members={[]} />);

    expect(screen.getByText('Nobody is away today')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = routed(
      <>
        <BriefingOnLeave people={[away]} members={[]} />
        <BriefingCelebrations celebrations={[birthday, anniversary]} members={[]} />
      </>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('BriefingEmptyState', () => {
  it('announces that all is clear with the next 1:1', () => {
    renderWithProviders(
      <BriefingEmptyState nextMeetingInfo="Your next 1:1 is with Dana on Thursday." />,
    );

    const message = screen.getByText(/^All clear today\./);
    expect(message).toHaveTextContent('All clear today. Your next 1:1 is with Dana on Thursday.');
    expect(message.closest('[role="status"]')).not.toBeNull();
  });

  it('shows just the all clear message without a next 1:1', () => {
    renderWithProviders(<BriefingEmptyState />);

    expect(screen.getByText(/^All clear today\./)).toHaveTextContent(/^All clear today\.$/);
  });
});
