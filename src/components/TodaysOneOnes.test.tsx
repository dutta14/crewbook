import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { createActionItem, createMember, createNote } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { Schedule } from '../types/Schedule';
import type { TeamMember } from '../types/TeamMember';
import { TodaysOneOnes } from './TodaysOneOnes';

// Sunday 8 November 2026.
const NOW = new Date(2026, 10, 8, 12, 0);
const TODAY = '2026-11-08';

const schedule = (nextDate: string, time = '10:00'): Schedule => ({
  cadence: 'weekly',
  dayOfWeek: 'monday',
  time,
  nextDate,
});

const ALEX = createMember({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Alex Chen',
  schedule: schedule(TODAY, '14:30'),
});
const PRIYA = createMember({
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Priya Nair',
  schedule: schedule(TODAY, '09:00'),
});
const SAM = createMember({
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Sam Ortiz',
  schedule: schedule('2026-11-10'),
});

const renderCard = (members: TeamMember[], privateData: Record<string, unknown> = {}) =>
  renderWithProviders(
    <Routes>
      <Route path="/" element={<TodaysOneOnes members={members} now={NOW} />} />
      <Route path="/person/:id" element={<p>Profile page</p>} />
    </Routes>,
    { initialData: { members }, initialPrivateData: privateData },
  );

describe('TodaysOneOnes', () => {
  it('renders the section heading as an h3 that labels the section', () => {
    renderCard([ALEX]);

    const heading = screen.getByRole('heading', { level: 3, name: "Today's 1:1s" });
    expect(screen.getByRole('region', { name: "Today's 1:1s" })).toHaveAttribute(
      'aria-labelledby',
      heading.id,
    );
  });

  it('shows name, time, open action items and last met date for each 1:1 today, earliest first', () => {
    renderCard([ALEX, PRIYA, SAM], {
      actionItems: [
        createActionItem({ memberId: ALEX.id }),
        createActionItem({ memberId: ALEX.id }),
        createActionItem({ memberId: ALEX.id, status: 'done' }),
      ],
      notes: [
        createNote({ memberId: ALEX.id, createdAt: new Date(2026, 9, 20, 9).toISOString() }),
        createNote({ memberId: ALEX.id, createdAt: new Date(2026, 9, 28, 9).toISOString() }),
      ],
    });

    const rows = screen.getAllByRole('link');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Priya Nair');
    expect(rows[0]).toHaveTextContent('9:00 AM');
    expect(rows[1]).toHaveTextContent('Alex Chen');
    expect(rows[1]).toHaveTextContent('2:30 PM');
    expect(within(rows[1]).getByLabelText('2 open action items')).toHaveTextContent('2');
    expect(within(rows[1]).getByText('Oct 28, 2026')).toHaveAttribute('datetime', '2026-10-28');
    expect(screen.queryByText('Sam Ortiz')).not.toBeInTheDocument();
  });

  it('hides the action items pill when nothing is open and says so when never met', () => {
    renderCard([PRIYA], {
      actionItems: [createActionItem({ memberId: PRIYA.id, status: 'done' })],
    });

    const row = screen.getByRole('link', { name: /Priya Nair/ });
    expect(within(row).queryByRole('img')).not.toBeInTheDocument();
    expect(row).toHaveTextContent('Not met yet');
    expect(row).not.toHaveTextContent(/open action/);
  });

  it('uses the singular in the pill label for one open item', () => {
    renderCard([PRIYA], { actionItems: [createActionItem({ memberId: PRIYA.id })] });

    expect(screen.getByLabelText('1 open action item')).toBeInTheDocument();
  });

  it('links each row to the opaque profile route and navigates on click', async () => {
    const user = userEvent.setup();
    renderCard([ALEX]);

    const link = screen.getByRole('link', { name: /Alex Chen/ });
    expect(link).toHaveAttribute('href', `/person/${ALEX.id}`);
    await user.click(link);

    expect(screen.getByText('Profile page')).toBeInTheDocument();
  });

  it('opens a row with the keyboard', async () => {
    const user = userEvent.setup();
    renderCard([ALEX]);

    await user.tab();
    expect(screen.getByRole('link', { name: /Alex Chen/ })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByText('Profile page')).toBeInTheDocument();
  });

  it('hides the avatar from assistive technology', () => {
    renderCard([ALEX]);

    expect(screen.queryByRole('img', { name: 'Alex Chen' })).not.toBeInTheDocument();
  });

  it('shows the empty state with the next upcoming 1:1', () => {
    renderCard([SAM]);

    expect(screen.getByText('No 1:1s scheduled today')).toBeInTheDocument();
    expect(screen.getByText('Next: Sam Ortiz on Tuesday')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('omits the next line when nobody has a schedule', () => {
    renderCard([createMember({ name: 'Unscheduled' })]);

    expect(screen.getByText('No 1:1s scheduled today')).toBeInTheDocument();
    expect(screen.queryByText(/^Next:/)).not.toBeInTheDocument();
  });

  it('skips a member with a damaged schedule instead of crashing', () => {
    const damaged = createMember({
      name: 'Damaged',
      schedule: { ...schedule(TODAY), time: 'noon' },
    });

    renderCard([damaged, ALEX]);

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText('Damaged')).not.toBeInTheDocument();
  });

  it('has no accessibility violations with entries or in the empty state', async () => {
    const { container, unmount } = renderCard([ALEX, PRIYA], {
      actionItems: [createActionItem({ memberId: ALEX.id })],
    });
    expect(await axe(container)).toHaveNoViolations();
    unmount();

    const empty = renderCard([SAM]);
    expect(await axe(empty.container)).toHaveNoViolations();
  });
});
