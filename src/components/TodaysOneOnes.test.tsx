import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { BriefingMeeting } from '../types/briefing';
import { TodaysOneOnes } from './TodaysOneOnes';

const ALEX = createMember({ id: '11111111-1111-4111-8111-111111111111', name: 'Alex Chen' });

const meeting = (overrides: Partial<BriefingMeeting> = {}): BriefingMeeting => ({
  engineerId: ALEX.id,
  name: ALEX.name,
  time: '14:30',
  openActionItems: 0,
  lastMetDate: null,
  ...overrides,
});

const renderCard = (meetings: BriefingMeeting[]) =>
  renderWithProviders(
    <Routes>
      <Route path="/" element={<TodaysOneOnes meetings={meetings} members={[ALEX]} />} />
      <Route path="/person/:id" element={<p>Profile page</p>} />
    </Routes>,
  );

describe('TodaysOneOnes', () => {
  it('renders the section heading as an h3 that labels the section', () => {
    renderCard([]);

    const heading = screen.getByRole('heading', { level: 3, name: "Today's 1:1s" });
    expect(screen.getByRole('region', { name: "Today's 1:1s" })).toHaveAttribute(
      'aria-labelledby',
      heading.id,
    );
  });

  it('shows name, time, open action items and last met date for each 1:1', () => {
    renderCard([
      meeting({ openActionItems: 2, lastMetDate: new Date(2026, 9, 28, 9).toISOString() }),
      meeting({ engineerId: 'other', name: 'Priya Nair', time: '09:00' }),
    ]);

    const rows = screen.getAllByRole('link');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName('1:1 with Alex Chen at 2:30 PM');
    expect(within(rows[0]).getByLabelText('2 open action items')).toHaveTextContent('2');
    expect(within(rows[0]).getByText('Oct 28, 2026')).toHaveAttribute('datetime', '2026-10-28');
    expect(rows[1]).toHaveTextContent('Priya Nair');
    expect(rows[1]).toHaveTextContent('Not met yet');
    expect(within(rows[1]).queryByRole('img')).not.toBeInTheDocument();
  });

  it('uses the singular in the pill label for one open item', () => {
    renderCard([meeting({ openActionItems: 1 })]);

    expect(screen.getByLabelText('1 open action item')).toBeInTheDocument();
  });

  it('links each row to the opaque profile route and navigates on click', async () => {
    const user = userEvent.setup();
    renderCard([meeting()]);

    const link = screen.getByRole('link', { name: /Alex Chen/ });
    expect(link).toHaveAttribute('href', `/person/${ALEX.id}`);
    await user.click(link);

    expect(screen.getByText('Profile page')).toBeInTheDocument();
  });

  it('opens a row with the keyboard', async () => {
    const user = userEvent.setup();
    renderCard([meeting()]);

    await user.tab();
    await user.tab();
    expect(screen.getByRole('link', { name: /Alex Chen/ })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByText('Profile page')).toBeInTheDocument();
  });

  it('hides the avatar from assistive technology', () => {
    renderCard([meeting()]);

    expect(screen.queryByRole('img', { name: 'Alex Chen' })).not.toBeInTheDocument();
  });

  it('says so when nothing is scheduled', () => {
    renderCard([]);

    expect(screen.getByText('No 1:1s scheduled today')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('has no accessibility violations with entries or without', async () => {
    const { container, unmount } = renderCard([meeting({ openActionItems: 2 })]);
    expect(await axe(container)).toHaveNoViolations();
    unmount();

    const empty = renderCard([]);
    expect(await axe(empty.container)).toHaveNoViolations();
  });
});
