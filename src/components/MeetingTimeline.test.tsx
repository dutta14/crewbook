import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { MeetingTimelineEntry } from '../types/meeting';
import { MeetingTimeline } from './MeetingTimeline';

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';

const entries = (count: number): MeetingTimelineEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `note-${index + 1}`,
    date: new Date(2026, 10, 8 - index, 9).toISOString(),
    notePreview: `Discussed topic ${index + 1}`,
  }));

const renderTimeline = (list: MeetingTimelineEntry[]) =>
  renderWithProviders(
    <Routes>
      <Route path="/" element={<MeetingTimeline memberId={MEMBER_ID} entries={list} />} />
      <Route path="/person/:id" element={<p>Profile page</p>} />
    </Routes>,
  );

describe('MeetingTimeline', () => {
  it('lists meetings newest first in an ordered list', () => {
    renderTimeline(entries(3));

    const list = screen.getByRole('list', { name: 'Meeting history' });
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Nov 8');
    expect(items[0]).toHaveTextContent('Discussed topic 1');
    expect(items[2]).toHaveTextContent('Discussed topic 3');
  });

  it('links each entry to its note on the profile', () => {
    renderTimeline(entries(2));

    expect(screen.getAllByRole('link')[1]).toHaveAttribute(
      'href',
      `/person/${MEMBER_ID}?note=note-2`,
    );
  });

  it('shows only ten entries until Show all is chosen', async () => {
    const user = userEvent.setup();
    renderTimeline(entries(12));

    expect(screen.getAllByRole('listitem')).toHaveLength(10);

    await user.click(screen.getByRole('button', { name: 'Show all 12 meetings' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(12);
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
  });

  it('moves focus to the first revealed entry after Show all', async () => {
    const user = userEvent.setup();
    renderTimeline(entries(12));

    await user.click(screen.getByRole('button', { name: /Show all/ }));

    await expect.poll(() => document.activeElement).toBe(screen.getAllByRole('link')[10]);
  });

  it('has no Show all control at ten entries or fewer', () => {
    renderTimeline(entries(10));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no meetings', () => {
    renderTimeline([]);

    expect(screen.getByText('No meetings yet')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('hides the decorative dots and lines from assistive technology', () => {
    const { container } = renderTimeline(entries(2));

    const decorations = container.querySelectorAll(
      '.meeting-timeline__dot, .meeting-timeline__line',
    );
    expect(decorations).toHaveLength(4);
    decorations.forEach((node) => expect(node).toHaveAttribute('aria-hidden', 'true'));
  });

  it('opens the profile when an entry is clicked', async () => {
    const user = userEvent.setup();
    renderTimeline(entries(1));

    await user.click(screen.getByRole('link'));

    expect(screen.getByText('Profile page')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderTimeline(entries(12));

    expect(await axe(container)).toHaveNoViolations();
  });
});
