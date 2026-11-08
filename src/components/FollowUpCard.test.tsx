import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createFollowUp } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { FollowUp } from '../types/decisions';
import { FollowUpCard } from './FollowUpCard';

const NOW = new Date(2025, 0, 20, 12);

const followUp = (overrides: Partial<FollowUp> = {}) =>
  createFollowUp({
    title: 'Share the migration plan',
    ownerId: 'priya',
    ownerName: 'Priya Nair',
    dueDate: '2025-01-31',
    linkedMeetingDate: '2025-01-15',
    ...overrides,
  });

const renderCard = (
  item: FollowUp = followUp(),
  props: Partial<Parameters<typeof FollowUpCard>[0]> = {},
) =>
  renderWithProviders(
    <FollowUpCard followUp={item} onStatusChange={vi.fn()} now={NOW} {...props} />,
  );

describe('FollowUpCard', () => {
  it('renders the title, owner, due date and status', () => {
    renderCard();

    const card = screen.getByRole('article', { name: 'Follow-up: Share the migration plan' });
    expect(card).toHaveTextContent('Share the migration plan');
    expect(card).toHaveTextContent('Priya Nair');
    expect(card).toHaveTextContent('Due Jan 31, 2025');
    expect(screen.getByRole('button', { name: 'Mark as done' })).toHaveTextContent('Pending');
  });

  it('shows the owner’s avatar with initials', () => {
    renderCard();

    expect(screen.getByText('PN')).toBeInTheDocument();
  });

  it('prefers the owner’s current name over the stored one', () => {
    renderCard(followUp(), { ownerName: 'Priya N. Rao' });

    expect(screen.getByText('Priya N. Rao')).toBeInTheDocument();
    expect(screen.queryByText('Priya Nair')).not.toBeInTheDocument();
  });

  it('marks the due date up as a time element with a machine-readable value', () => {
    const { container } = renderCard();

    expect(container.querySelector('time')).toHaveAttribute('datetime', '2025-01-31');
  });

  it('flags a past due date as overdue with text for screen readers', () => {
    renderCard(followUp({ dueDate: '2025-01-10' }));

    expect(screen.getByText('(overdue)')).toHaveClass('sr-only');
    expect(screen.getByText(/^Due/)).toHaveClass('decision-card__due--overdue');
  });

  it('does not flag a done follow-up as overdue', () => {
    renderCard(followUp({ dueDate: '2025-01-10', status: 'done' }));

    expect(screen.queryByText('(overdue)')).not.toBeInTheDocument();
  });

  it('says when there is no due date', () => {
    renderCard(followUp({ dueDate: undefined }));

    expect(screen.getByText('No due date')).toBeInTheDocument();
  });

  it('labels the toggle with the action it will take', () => {
    const { rerender } = renderCard();
    expect(screen.getByRole('button', { name: 'Mark as done' })).toBeInTheDocument();

    rerender(
      <FollowUpCard followUp={followUp({ status: 'done' })} onStatusChange={vi.fn()} now={NOW} />,
    );
    expect(screen.getByRole('button', { name: 'Mark as pending' })).toHaveTextContent('Done');
  });

  it('calls onStatusChange with the status it is moving to', async () => {
    const user = userEvent.setup();
    const item = followUp();
    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    renderCard(item, { onStatusChange });

    await user.click(screen.getByRole('button', { name: 'Mark as done' }));

    expect(onStatusChange).toHaveBeenCalledExactlyOnceWith(item.id, 'done');
  });

  it('announces the change politely once it has been saved', async () => {
    const user = userEvent.setup();
    renderCard();
    const region = within(screen.getByRole('article')).getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();

    await user.click(screen.getByRole('button', { name: 'Mark as done' }));

    expect(await screen.findByText('Follow-up marked as done')).toBe(region);
  });

  it('announces nothing when the change is rejected', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn().mockRejectedValue(new Error('disk'));
    renderCard(followUp(), { onStatusChange });

    await user.click(screen.getByRole('button', { name: 'Mark as done' }));

    expect(onStatusChange).toHaveBeenCalledOnce();
    expect(within(screen.getByRole('article')).getByRole('status')).toBeEmptyDOMElement();
  });

  it('ignores a second press while the first change is still being saved', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn(() => new Promise<void>(() => undefined));
    renderCard(followUp(), { onStatusChange });

    await user.click(screen.getByRole('button', { name: 'Mark as done' }));
    await user.click(screen.getByRole('button', { name: 'Mark as done' }));

    expect(onStatusChange).toHaveBeenCalledOnce();
  });

  it('has no accessibility violations, overdue or not', async () => {
    const { container } = renderCard(followUp({ dueDate: '2025-01-10' }), { personName: 'Alex' });

    expect(await axe(container)).toHaveNoViolations();
  });
});
