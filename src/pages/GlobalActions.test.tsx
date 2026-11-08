import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { createActionItem, createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { ActionItem } from '../types/ActionItem';
import { GlobalActions } from './GlobalActions';

const ALEX = createMember({ id: '11111111-1111-4111-8111-111111111111', name: 'Alex Chen' });
const PRIYA = createMember({ id: '22222222-2222-4222-8222-222222222222', name: 'Priya Nair' });
const SAM = createMember({ id: '33333333-3333-4333-8333-333333333333', name: 'Sam Ortiz' });

const ITEMS: ActionItem[] = [
  createActionItem({ memberId: ALEX.id, title: 'Later task', dueDate: '2099-06-01' }),
  createActionItem({ memberId: PRIYA.id, title: 'Sooner task', dueDate: '2099-01-01' }),
  createActionItem({ memberId: SAM.id, title: 'Undated task' }),
  createActionItem({ memberId: SAM.id, title: 'Finished task', status: 'done' }),
];

const renderPage = (items: ActionItem[] = ITEMS) =>
  renderWithProviders(<GlobalActions />, {
    initialData: { members: [ALEX, PRIYA, SAM] },
    initialPrivateData: { actionItems: items },
  });

const titles = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1].textContent);

describe('GlobalActions', () => {
  it('lists open items across all members, sorted by due date with undated last', () => {
    renderPage();

    expect(titles()).toEqual(['Sooner task', 'Later task', 'Undated task']);
    expect(screen.getByRole('table', { name: 'Action items across team' })).toBeInTheDocument();
  });

  it('moves keyboard focus to the page heading on mount', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Action Items' })).toHaveFocus();
  });

  it('links each person to their profile', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Priya Nair' })).toHaveAttribute(
      'href',
      `/person/${PRIYA.id}`,
    );
  });

  it('sets aria-sort on the active column and toggles direction on click', async () => {
    const user = userEvent.setup();
    renderPage();

    const due = screen.getByRole('columnheader', { name: /Due date/ });
    expect(due).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );

    await user.click(within(due).getByRole('button'));
    expect(due).toHaveAttribute('aria-sort', 'descending');
    expect(titles()).toEqual(['Later task', 'Sooner task', 'Undated task']);
  });

  it('sorts by title when the Title column is activated', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Title/ }));

    expect(titles()).toEqual(['Later task', 'Sooner task', 'Undated task']);
    expect(screen.getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('filters by person', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText('Person'), 'Sam Ortiz');

    expect(titles()).toEqual(['Undated task']);
  });

  it('filters by status and shows every status under All', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Done' }));
    expect(titles()).toEqual(['Finished task']);

    await user.click(screen.getByRole('radio', { name: 'All' }));
    expect(titles()).toHaveLength(4);
  });

  it('shows a filter message when the chosen filters match nothing', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: 'Cancelled' }));

    expect(screen.getByText('No action items match these filters.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Open' })).toBeInTheDocument();
  });

  it('shows the empty state when there are no open action items', () => {
    renderPage([]);

    expect(
      screen.getByText('No open action items across your team. Nice work!'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the empty state but keeps the controls when only closed items exist', () => {
    renderPage([ITEMS[3]]);

    expect(
      screen.getByText('No open action items across your team. Nice work!'),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Done' })).toBeInTheDocument();
  });

  it('omits items whose member no longer exists', () => {
    renderPage([...ITEMS, createActionItem({ memberId: 'gone', title: 'Orphan' })]);

    expect(titles()).not.toContain('Orphan');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });
});
