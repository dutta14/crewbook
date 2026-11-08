import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createDecision, createFollowUp, createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { DecisionFollowUpList } from './DecisionFollowUpList';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

const decisions = [
  createDecision({
    engineerId: ALEX.id,
    title: 'Older decision',
    createdAt: '2025-01-01T00:00:00.000Z',
  }),
  createDecision({
    engineerId: PRIYA.id,
    title: 'Newest decision',
    createdAt: '2025-03-01T00:00:00.000Z',
  }),
];
const followUps = [
  createFollowUp({
    engineerId: ALEX.id,
    title: 'Middle follow-up',
    createdAt: '2025-02-01T00:00:00.000Z',
  }),
  createFollowUp({
    engineerId: ALEX.id,
    title: 'Third follow-up',
    createdAt: '2025-01-15T00:00:00.000Z',
  }),
  createFollowUp({
    engineerId: ALEX.id,
    title: 'Fourth follow-up',
    createdAt: '2025-01-10T00:00:00.000Z',
  }),
];

const renderList = (props: Partial<Parameters<typeof DecisionFollowUpList>[0]> = {}) =>
  renderWithProviders(
    <DecisionFollowUpList
      decisions={decisions}
      followUps={followUps}
      members={[ALEX, PRIYA]}
      meetingIds={new Set<string>()}
      onStatusChange={vi.fn()}
      {...props}
    />,
  );

const titles = () =>
  within(screen.getByRole('list', { name: 'Decisions and follow-ups' }))
    .getAllByRole('article')
    .map((article) => article.getAttribute('aria-label'));

describe('DecisionFollowUpList', () => {
  it('shows decisions and follow-ups together, newest first', () => {
    renderList();

    expect(titles()).toEqual([
      'Decision: Newest decision',
      'Follow-up: Middle follow-up',
      'Follow-up: Third follow-up',
      'Follow-up: Fourth follow-up',
      'Decision: Older decision',
    ]);
  });

  it('starts on All', () => {
    renderList();

    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
    expect(screen.getByRole('radiogroup', { name: 'Filter by type' })).toBeInTheDocument();
  });

  it('shows only decisions when Decisions is chosen', async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole('radio', { name: 'Decisions' }));

    expect(titles()).toEqual(['Decision: Newest decision', 'Decision: Older decision']);
  });

  it('shows only follow-ups when Follow-ups is chosen', async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole('radio', { name: 'Follow-ups' }));

    expect(titles()).toHaveLength(3);
    expect(titles().every((label) => label?.startsWith('Follow-up:'))).toBe(true);
  });

  it('announces how many entries each filter shows', async () => {
    const user = userEvent.setup();
    renderList();
    expect(screen.getByText('Showing 5 entries')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Decisions' }));
    expect(screen.getByText('Showing 2 decisions')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Follow-ups' }));
    expect(screen.getByText('Showing 3 follow-ups')).toBeInTheDocument();
  });

  it('moves between filters with the arrow keys', async () => {
    const user = userEvent.setup();
    renderList();
    screen.getByRole('radio', { name: 'All' }).focus();

    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: 'Decisions' })).toBeChecked();
  });

  it('shows the empty state when there is nothing', () => {
    renderList({ decisions: [], followUps: [] });

    expect(screen.getByText('No decisions or follow-ups yet')).toBeInTheDocument();
    expect(screen.getByText('Capture them during your next 1:1')).toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Decisions and follow-ups' }),
    ).not.toBeInTheDocument();
  });

  it('shows the empty state when a filter leaves nothing', async () => {
    const user = userEvent.setup();
    renderList({ decisions: [] });

    await user.click(screen.getByRole('radio', { name: 'Decisions' }));

    expect(screen.getByText('No decisions or follow-ups yet')).toBeInTheDocument();
  });

  it('names the person on each card only when asked to', () => {
    const { unmount } = renderList();
    expect(screen.queryByRole('link', { name: 'Priya Nair' })).not.toBeInTheDocument();
    unmount();

    renderList({ showPerson: true });
    expect(screen.getByRole('link', { name: 'Priya Nair' })).toBeInTheDocument();
  });

  it('shows the owner’s current name from the team', () => {
    renderList({
      followUps: [
        createFollowUp({ engineerId: ALEX.id, ownerId: PRIYA.id, ownerName: 'Old Name' }),
      ],
    });

    expect(screen.getByText('Priya Nair')).toBeInTheDocument();
    expect(screen.queryByText('Old Name')).not.toBeInTheDocument();
  });

  it('keeps the stored owner name for the manager', () => {
    renderList({ followUps: [createFollowUp({ engineerId: ALEX.id })] });

    expect(screen.getByText('Me')).toBeInTheDocument();
  });

  it('links only to notes that still exist', () => {
    const linked = createDecision({
      engineerId: ALEX.id,
      linkedMeetingId: 'n1',
      linkedMeetingDate: '2025-01-15',
    });
    renderList({ decisions: [linked], followUps: [], meetingIds: new Set(['n1']) });

    expect(screen.getByRole('link', { name: /View 1:1 notes/ })).toBeInTheDocument();
  });

  it('renders extra toolbar controls beside the filter', () => {
    renderList({ toolbar: <button type="button">Extra</button> });

    expect(screen.getByRole('button', { name: 'Extra' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderList({ showPerson: true });

    expect(await axe(container)).toHaveNoViolations();
  });
});
