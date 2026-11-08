import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { GapAlertData } from '../types/meeting';
import type { Schedule } from '../types/Schedule';
import type { TeamMember } from '../types/TeamMember';
import { GapAlert, GapAlertCard } from './GapAlert';

// Sunday 8 November 2026.
const NOW = new Date(2026, 10, 8, 12, 0);
const weekly: Schedule = {
  cadence: 'weekly',
  dayOfWeek: 'monday',
  time: '10:00',
  nextDate: '2026-11-09',
};

const ALEX = createMember({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Alex Chen',
  schedule: weekly,
});
const PRIYA = createMember({
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Priya Nair',
  schedule: weekly,
});
const SAM = createMember({
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Sam Ortiz',
  schedule: weekly,
});

const alert = (overrides: Partial<GapAlertData> = {}): GapAlertData => ({
  engineerId: ALEX.id,
  engineerName: ALEX.name,
  daysSinceLastMeeting: 21,
  cadenceDays: 7,
  isOverdue: true,
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GapAlert', () => {
  it('shows the gap as a short duration with an accessible label', () => {
    renderWithProviders(<GapAlert alert={alert()} />);

    expect(screen.getByRole('img', { name: 'Overdue: last met 3 weeks ago' })).toHaveTextContent(
      '3 weeks',
    );
  });

  it('shows days while the gap is under two weeks', () => {
    renderWithProviders(<GapAlert alert={alert({ daysSinceLastMeeting: 11, cadenceDays: 7 })} />);

    expect(screen.getByRole('img', { name: 'Overdue: last met 11 days ago' })).toBeInTheDocument();
  });

  it('renders nothing when the 1:1s are on schedule', () => {
    const { container } = renderWithProviders(<GapAlert alert={alert({ isOverdue: false })} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing without an alert', () => {
    const { container } = renderWithProviders(<GapAlert />);

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps names and ids out of the badge attributes', () => {
    renderWithProviders(<GapAlert alert={alert()} />);

    const badge = screen.getByRole('img');
    expect(badge.outerHTML).not.toContain(ALEX.id);
    expect(badge.outerHTML).not.toContain('Alex');
  });
});

describe('GapAlertCard', () => {
  const renderCard = (alerts: GapAlertData[], members: TeamMember[] = [ALEX, PRIYA, SAM]) =>
    renderWithProviders(
      <Routes>
        <Route path="/" element={<GapAlertCard alerts={alerts} members={members} />} />
        <Route path="/person/:id" element={<p>Profile page</p>} />
      </Routes>,
    );

  it('labels the card with an Overdue 1:1s heading', () => {
    renderCard([]);

    const heading = screen.getByRole('heading', { level: 3, name: 'Overdue 1:1s' });
    expect(screen.getByRole('region', { name: 'Overdue 1:1s' })).toHaveAttribute(
      'aria-labelledby',
      heading.id,
    );
  });

  it('lists each overdue person in the order given, with when they last met', () => {
    renderCard([
      alert({ engineerId: PRIYA.id, engineerName: PRIYA.name, daysSinceLastMeeting: 30 }),
      alert({ daysSinceLastMeeting: 12 }),
    ]);

    const rows = screen.getAllByRole('link');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Priya Nair');
    expect(rows[0]).toHaveTextContent('Last met 30 days ago');
    expect(rows[1]).toHaveTextContent('Alex Chen');
    expect(rows[1]).toHaveAccessibleName('Overdue 1:1 with Alex Chen, last met 12 days ago');
  });

  it('uses the singular for one day', () => {
    renderCard([alert({ daysSinceLastMeeting: 1 })]);

    expect(screen.getByText('Last met 1 day ago')).toBeInTheDocument();
  });

  it('says everyone is caught up when nobody is overdue', () => {
    renderCard([]);

    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('opens the profile of the person who was clicked', async () => {
    const user = userEvent.setup();
    renderCard([alert()]);

    await user.click(screen.getByRole('link', { name: /Alex Chen/ }));

    expect(screen.getByText('Profile page')).toBeInTheDocument();
  });

  it('has no accessibility violations with overdue people listed', async () => {
    const { container } = renderCard([alert()]);

    expect(await axe(container)).toHaveNoViolations();
  });
});
