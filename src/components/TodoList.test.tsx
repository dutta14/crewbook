import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMember, createTodo } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { Todo } from '../types/todo';
import { TodoList } from './TodoList';

const NOW = new Date(2026, 5, 15, 12);
const ALEX = createMember({ id: '11111111-1111-4111-8111-111111111111', name: 'Alex Chen' });
const PRIYA = createMember({ id: '22222222-2222-4222-8222-222222222222', name: 'Priya Nair' });

const TODOS: Todo[] = [
  createTodo({ title: 'Later low', priority: 'low', dueDate: '2026-09-01' }),
  createTodo({
    title: 'Soon high',
    priority: 'high',
    dueDate: '2026-06-20',
    linkedPersonId: ALEX.id,
  }),
  createTodo({ title: 'Undated medium', priority: 'medium', status: 'in_progress' }),
  createTodo({ title: 'Finished', priority: 'medium', status: 'done', linkedPersonId: PRIYA.id }),
];

const renderList = (todos: Todo[] = TODOS) =>
  renderWithProviders(<TodoList now={NOW} />, {
    initialData: { members: [ALEX, PRIYA] },
    initialPrivateData: { todos },
  });

const titles = () =>
  screen
    .getAllByRole('checkbox')
    .map((checkbox) => (checkbox as HTMLInputElement).labels?.[0]?.textContent);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TodoList', () => {
  it('shows an encouraging empty state and no filters when there are no tasks', () => {
    renderList([]);

    expect(screen.getByText('All clear! No pending tasks.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Sort by')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add task' })).toBeInTheDocument();
  });

  it('lists tasks in a semantic list, soonest due date first with undated last', () => {
    renderList();

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(titles()).toEqual(['Soon high', 'Later low', 'Undated medium', 'Finished']);
  });

  it('announces how many tasks are shown', () => {
    renderList();

    expect(screen.getByText('4 tasks shown')).toBeInTheDocument();
  });

  it('sorts by priority from high to low', async () => {
    const user = userEvent.setup();
    renderList();

    await user.selectOptions(screen.getByLabelText('Sort by'), 'priority');

    expect(titles()[0]).toBe('Soon high');
    expect(titles()[3]).toBe('Later low');
  });

  it('filters by status', async () => {
    const user = userEvent.setup();
    renderList();

    await user.selectOptions(screen.getByLabelText('Status'), 'done');

    expect(titles()).toEqual(['Finished']);
    expect(screen.getByText('1 task shown')).toBeInTheDocument();
  });

  it('filters by priority', async () => {
    const user = userEvent.setup();
    renderList();

    await user.selectOptions(screen.getByLabelText('Priority'), 'medium');

    expect(titles()).toEqual(['Undated medium', 'Finished']);
  });

  it('filters by linked person', async () => {
    const user = userEvent.setup();
    renderList();

    await user.selectOptions(screen.getByLabelText('Person'), ALEX.id);

    expect(titles()).toEqual(['Soon high']);
  });

  it('says so when no task matches the filters and restores the list when cleared', async () => {
    const user = userEvent.setup();
    renderList();
    await user.selectOptions(screen.getByLabelText('Status'), 'done');
    await user.selectOptions(screen.getByLabelText('Priority'), 'high');

    expect(screen.getByText('No tasks match these filters.')).toBeInTheDocument();
    expect(screen.queryByText('All clear! No pending tasks.')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Status'), '');
    await user.selectOptions(screen.getByLabelText('Priority'), '');
    expect(titles()).toHaveLength(4);
  });

  it('adds a task from the form and confirms with a toast', async () => {
    const user = userEvent.setup();
    renderList([]);

    await user.click(screen.getByRole('button', { name: '+ Add task' }));
    await user.type(screen.getByRole('textbox', { name: /Title/ }), 'Plan offsite');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Task added')).toBeInTheDocument();
    expect(await screen.findByLabelText('Plan offsite')).toBeInTheDocument();
    expect(screen.queryByText('All clear! No pending tasks.')).not.toBeInTheDocument();
  });

  it('edits a task through the overflow menu', async () => {
    const user = userEvent.setup();
    renderList([createTodo({ title: 'Old title' })]);

    await user.click(screen.getByRole('button', { name: 'Task actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const title = screen.getByRole('textbox', { name: /Title/ });
    expect(title).toHaveValue('Old title');
    await user.clear(title);
    await user.type(title, 'New title');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Task updated')).toBeInTheDocument();
    expect(await screen.findByLabelText('New title')).toBeInTheDocument();
    expect(screen.queryByLabelText('Old title')).not.toBeInTheDocument();
  });

  it('completes a task from its checkbox', async () => {
    const user = userEvent.setup();
    renderList([createTodo({ title: 'Do it' })]);

    await user.click(screen.getByRole('checkbox', { name: 'Do it' }));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Do it' })).toBeChecked());
    expect(screen.getByText('Task Do it marked as done')).toBeInTheDocument();
  });

  it('asks for confirmation without repeating the title, then deletes and focuses Add', async () => {
    const user = userEvent.setup();
    renderList([createTodo({ title: 'Confidential PIP draft' })]);

    await user.click(screen.getByRole('button', { name: 'Task actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete this task?');
    expect(dialog).toHaveTextContent("This can't be undone.");
    expect(dialog).not.toHaveTextContent('Confidential PIP draft');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Task deleted')).toBeInTheDocument();
    expect(screen.queryByLabelText('Confidential PIP draft')).not.toBeInTheDocument();
    expect(screen.getByText('All clear! No pending tasks.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add task' })).toHaveFocus();
  });

  it('keeps the task when the delete is cancelled', async () => {
    const user = userEvent.setup();
    renderList([createTodo({ title: 'Keep me' })]);

    await user.click(screen.getByRole('button', { name: 'Task actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );

    expect(screen.getByLabelText('Keep me')).toBeInTheDocument();
  });

  it('moves filters into a bottom sheet on a narrow screen', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const user = userEvent.setup();
    renderList();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    await user.selectOptions(screen.getByLabelText('Status'), 'done');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(titles()).toEqual(['Finished']));
    expect(screen.getByRole('button', { name: 'Filter (1)' })).toBeInTheDocument();
  });

  it('has no accessibility violations with tasks', async () => {
    const { container } = renderList();

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations when empty', async () => {
    const { container } = renderList([]);

    expect(await axe(container)).toHaveNoViolations();
  });
});
