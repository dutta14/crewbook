import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toIsoDate } from '../utils/scheduleCalculator';
import { createActionItem, createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { ActionItem } from '../types/ActionItem';
import { AddActionItem } from './ActionItemInline';
import { ActionItemList } from './ActionItemList';

const ALEX = createMember({ id: '11111111-1111-4111-8111-111111111111', name: 'Alex Chen' });
const PRIYA = createMember({ id: '22222222-2222-4222-8222-222222222222', name: 'Priya Nair' });

const daysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
};

const item = (overrides: Partial<ActionItem> = {}) =>
  createActionItem({ memberId: ALEX.id, ...overrides });

const renderList = (items: ActionItem[] = []) =>
  renderWithProviders(
    <>
      <AddActionItem memberId={ALEX.id} />
      <ActionItemList memberId={ALEX.id} />
    </>,
    { initialData: { members: [ALEX, PRIYA] }, initialPrivateData: { actionItems: items } },
  );

const offerCheckbox = () => screen.getByRole('checkbox', { name: 'Mark Send the offer as done' });

afterEach(() => {
  vi.useRealTimers();
});

describe('ActionItemList', () => {
  it('action item appears in the list after creation', async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole('button', { name: '+ Action Item' }));
    await user.type(screen.getByLabelText('Title'), 'Update oncall runbook');
    await user.selectOptions(screen.getByLabelText('Owner'), 'Priya Nair');
    await user.type(screen.getByLabelText('Due date (optional)'), '2099-01-02');
    await user.click(screen.getByRole('button', { name: 'Add action item' }));

    const row = (await screen.findByText('Update oncall runbook')).closest('li');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Priya Nair')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText(/2099/)).toBeInTheDocument();
  });

  it('clicking checkbox marks item as done with native input', async () => {
    const user = userEvent.setup();
    renderList([item({ title: 'Send the offer' })]);

    const checkbox = screen.getByRole('checkbox', { name: 'Mark Send the offer as done' });
    expect(checkbox.tagName).toBe('INPUT');
    expect(checkbox).toHaveAttribute('type', 'checkbox');
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(screen.getByText('Send the offer')).toHaveTextContent('Send the offer');
    expect(screen.getByText('Send the offer').closest('li')).toHaveClass('action-item--done');
  });

  it('checkbox has aria-label "Mark [title] as done"', () => {
    renderList([item({ title: 'Book the room' })]);

    expect(screen.getByLabelText('Mark Book the room as done')).toBeInTheDocument();
  });

  it('undo link appears for 5 seconds after marking done', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderList([item({ title: 'Send the offer' })]);

    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    await user.click(offerCheckbox());
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(4900));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(offerCheckbox()).toBeChecked();
  });

  it('undo reverts item to open status', async () => {
    const user = userEvent.setup();
    renderList([item({ title: 'Send the offer' })]);

    await user.click(offerCheckbox());
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(offerCheckbox()).not.toBeChecked());
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(offerCheckbox()).toHaveFocus();
  });

  it('undo link is next in tab order after checkbox', async () => {
    const user = userEvent.setup();
    renderList([item({ title: 'Send the offer' })]);

    await user.click(offerCheckbox());
    offerCheckbox().focus();
    await user.tab();

    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
  });

  it('moves focus back to the checkbox when a focused Undo expires', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderList([item({ title: 'Send the offer' })]);

    await user.click(offerCheckbox());
    await user.tab();
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
    await act(() => vi.advanceTimersByTimeAsync(5100));

    expect(offerCheckbox()).toHaveFocus();
  });

  it('undo announced via aria-live="assertive"', async () => {
    const user = userEvent.setup();
    const { container } = renderList([item({ title: 'Send the offer' })]);

    await user.click(offerCheckbox());

    const live = container.querySelector('[aria-live="assertive"]');
    expect(live).toHaveTextContent('Send the offer marked as done. Undo available.');
  });

  it('keeps a done item visible under the Open filter so its Undo stays reachable', async () => {
    const user = userEvent.setup();
    renderList([item({ title: 'First' }), item({ title: 'Second' })]);

    await user.click(screen.getByRole('checkbox', { name: 'Mark First as done' }));
    await user.click(screen.getByRole('radio', { name: 'Done' }));

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Open' }));
    expect(screen.queryByText('First')).not.toBeInTheDocument();
  });

  it('unchecking a done item reopens it', async () => {
    const user = userEvent.setup();
    renderList([item({ title: 'Finished', status: 'done' })]);
    await user.click(screen.getByRole('radio', { name: 'Done' }));

    await user.click(screen.getByRole('checkbox', { name: 'Mark Finished as done' }));

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Mark Finished as done' })).not.toBeChecked(),
    );
  });

  it('cancelling an open item moves it to Cancelled, where it can be reopened', async () => {
    const user = userEvent.setup();
    renderList([item({ title: 'Drop me' })]);

    await user.click(screen.getByRole('button', { name: 'Cancel Drop me' }));
    expect(screen.getByText('Cancelled', { selector: '.action-item__state' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reopen Drop me' }));
    expect(screen.getByRole('checkbox', { name: 'Mark Drop me as done' })).toBeInTheDocument();
  });

  it('overdue items display due date in red with visible "Overdue" text', () => {
    renderList([
      item({ title: 'Late', dueDate: daysFromNow(-3) }),
      item({ title: 'On time', dueDate: daysFromNow(3) }),
    ]);

    const late = screen.getByText('Late').closest('li') as HTMLElement;
    const onTime = screen.getByText('On time').closest('li') as HTMLElement;
    expect(within(late).getByText('Overdue')).toBeVisible();
    expect(late.querySelector('.action-item__due--overdue')).not.toBeNull();
    expect(within(onTime).queryByText('Overdue')).not.toBeInTheDocument();
  });

  it('does not mark a done item overdue', async () => {
    const user = userEvent.setup();
    renderList([item({ title: 'Late', dueDate: daysFromNow(-3), status: 'done' })]);
    await user.click(screen.getByRole('radio', { name: 'Done' }));

    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
  });

  it('filter by status shows correct items', async () => {
    const user = userEvent.setup();
    renderList([
      item({ title: 'Open one' }),
      item({ title: 'Done one', status: 'done' }),
      item({ title: 'Cancelled one', status: 'cancelled' }),
    ]);

    expect(screen.getByText('Open one')).toBeInTheDocument();
    expect(screen.queryByText('Done one')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Done' }));
    expect(screen.getByText('Done one')).toBeInTheDocument();
    expect(screen.queryByText('Open one')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Cancelled' }));
    expect(screen.getByText('Cancelled one', { selector: '.action-item__title' })).toBeVisible();
    expect(screen.queryByText('Done one')).not.toBeInTheDocument();
  });

  it('says so when the chosen status has no items', async () => {
    const user = userEvent.setup();
    renderList([item({ title: 'Open one' })]);

    await user.click(screen.getByRole('radio', { name: 'Done' }));

    expect(screen.getByText('No done action items.')).toBeInTheDocument();
  });

  it('filter chips use role="radiogroup" with aria-label', () => {
    renderList([item()]);

    const group = screen.getByRole('radiogroup', { name: 'Filter by status' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.textContent),
    ).toEqual(['Open', 'Done', 'Cancelled']);
    expect(within(group).getByRole('radio', { name: 'Open' })).toBeChecked();
  });

  it('empty state renders "No action items" message', () => {
    renderList();

    expect(
      screen.getByText('No action items. Create one during your next 1:1.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('open items carry forward to prep view', () => {
    renderList([
      item({ title: 'From last month', createdAt: '2020-01-01T00:00:00.000Z' }),
      item({ title: 'From last week', createdAt: '2020-02-01T00:00:00.000Z' }),
      item({ title: 'Already done', status: 'done' }),
      createActionItem({ memberId: PRIYA.id, title: "Someone else's" }),
    ]);

    const list = screen.getByRole('list', { name: 'Open action items' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual([
      expect.stringContaining('From last month'),
      expect.stringContaining('From last week'),
    ]);
    expect(screen.getByText(/carry forward to your next 1:1/)).toBeInTheDocument();
  });

  it('renders titles as text and never as markup', () => {
    renderList([item({ title: '<img src=x onerror=alert(1)> **bold**' })]);

    expect(screen.getByText('<img src=x onerror=alert(1)> **bold**')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('shows the owner’s current name even after they were renamed', () => {
    renderList([item({ title: 'Follow up', ownerId: PRIYA.id, ownerName: 'Old Name' })]);

    expect(screen.getByText('Priya Nair')).toBeInTheDocument();
    expect(screen.queryByText('Old Name')).not.toBeInTheDocument();
  });

  it('lets the manager leave an item out of the share link and put it back', async () => {
    const user = userEvent.setup();
    renderList([item({ title: 'Sensitive follow-up' })]);

    const include = screen.getByRole('checkbox', {
      name: 'Include in share link: Sensitive follow-up',
    });
    expect(include).toBeChecked();
    expect(screen.queryByText('Not shared')).not.toBeInTheDocument();

    await user.click(include);
    await waitFor(() => expect(include).not.toBeChecked());
    expect(screen.getByText('Not shared')).toBeInTheDocument();

    await user.click(include);
    await waitFor(() => expect(include).toBeChecked());
    expect(screen.queryByText('Not shared')).not.toBeInTheDocument();
  });

  it('offers no share choice for an item owned by another team member or a cancelled one', () => {
    renderList([
      item({ title: 'Theirs', ownerId: PRIYA.id, ownerName: 'Priya Nair' }),
      item({ title: 'Dropped', status: 'cancelled' }),
    ]);

    expect(
      screen.queryByRole('checkbox', { name: /Include in share link/ }),
    ).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderList([
      item({ title: 'Late', dueDate: daysFromNow(-1) }),
      item({ title: 'Later', dueDate: daysFromNow(5) }),
    ]);

    expect(await axe(container)).toHaveNoViolations();
  });
});
