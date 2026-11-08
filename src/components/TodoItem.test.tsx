import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createMember, createTodo } from '../test-utils/factories';
import { TodoItem } from './TodoItem';

const NOW = new Date(2026, 5, 15, 12);
const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });

const renderItem = (todo = createTodo(), props: Partial<Parameters<typeof TodoItem>[0]> = {}) => {
  const handlers = {
    onToggle: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };
  const result = render(
    <ul>
      <TodoItem todo={todo} now={NOW} {...handlers} {...props} />
    </ul>,
  );
  return { ...result, ...handlers };
};

describe('TodoItem', () => {
  it('renders the title, priority badge and due date', () => {
    renderItem(createTodo({ title: 'Prep calibration', priority: 'high', dueDate: '2026-06-20' }));

    expect(screen.getByText('Prep calibration')).toBeInTheDocument();
    expect(screen.getByText('High priority')).toBeInTheDocument();
    expect(screen.getByText('Sat, Jun 20, 2026')).toHaveAttribute('datetime', '2026-06-20');
  });

  it('labels a native checkbox with the task title', () => {
    renderItem(createTodo({ title: 'Prep calibration' }));

    const checkbox = screen.getByRole('checkbox', { name: 'Prep calibration' });
    expect(checkbox.tagName).toBe('INPUT');
    expect(checkbox).not.toBeChecked();
    expect(checkbox).not.toHaveAttribute('aria-label');
  });

  it('asks to mark a task done when its checkbox is clicked', async () => {
    const todo = createTodo();
    const { onToggle } = renderItem(todo);

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onToggle).toHaveBeenCalledWith(todo.id);
  });

  it('toggles from the keyboard with Space', async () => {
    const { onToggle } = renderItem();

    screen.getByRole('checkbox').focus();
    await userEvent.keyboard(' ');

    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('announces a completed task through a polite live region', async () => {
    renderItem(createTodo({ title: 'Prep calibration' }));

    await userEvent.click(screen.getByRole('checkbox'));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Task Prep calibration marked as done',
    );
  });

  it('announces nothing and leaves the box alone when the save fails', async () => {
    const onToggle = vi.fn().mockRejectedValue(new Error('write failed'));
    renderItem(createTodo(), { onToggle });

    await userEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('shows a finished task checked and struck through, and reopens it on click', async () => {
    const { onToggle } = renderItem(createTodo({ title: 'Done thing', status: 'done' }));

    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('Done thing').className).toContain('todo-row__title--done');
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(await screen.findByRole('status')).toHaveTextContent('Task Done thing marked as to do');
  });

  it('flags an overdue task for sighted and screen reader users', () => {
    renderItem(createTodo({ dueDate: '2026-06-01' }));

    expect(screen.getByRole('listitem').className).toContain('todo-row--overdue');
    expect(screen.getByText('(overdue)')).toBeInTheDocument();
  });

  it.each([
    ['a finished task', createTodo({ dueDate: '2026-06-01', status: 'done' })],
    ['a task due today', createTodo({ dueDate: '2026-06-15' })],
    ['a task without a due date', createTodo()],
  ])('does not flag %s as overdue', (_name, todo) => {
    renderItem(todo);

    expect(screen.getByRole('listitem').className).not.toContain('overdue');
    expect(screen.queryByText('(overdue)')).not.toBeInTheDocument();
  });

  it('shows the linked person as an avatar named after them', () => {
    renderItem(createTodo({ linkedPersonId: ALEX.id }), { person: ALEX });

    expect(screen.getByRole('img', { name: 'Alex Chen' })).toBeInTheDocument();
  });

  it('shows no avatar for a task without a person', () => {
    renderItem();

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('marks a task that is under way', () => {
    renderItem(createTodo({ status: 'in_progress' }));

    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('exposes an overflow menu trigger that reports whether the menu is open', async () => {
    renderItem();

    const trigger = screen.getByRole('button', { name: 'Task actions' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('lists Edit and Delete as menu items and focuses the first', async () => {
    renderItem();

    await userEvent.click(screen.getByRole('button', { name: 'Task actions' }));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Edit',
      'Delete',
    ]);
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
  });

  it('moves between menu items with the arrow keys and wraps around', async () => {
    renderItem();
    await userEvent.click(screen.getByRole('button', { name: 'Task actions' }));

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
  });

  it('closes the menu on Escape and returns focus to the trigger', async () => {
    renderItem();
    const trigger = screen.getByRole('button', { name: 'Task actions' });
    await userEvent.click(trigger);

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes the menu when clicking elsewhere', async () => {
    renderItem();
    await userEvent.click(screen.getByRole('button', { name: 'Task actions' }));

    await userEvent.click(document.body);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls onEdit and onDelete from the menu', async () => {
    const todo = createTodo();
    const { onEdit, onDelete } = renderItem(todo);

    await userEvent.click(screen.getByRole('button', { name: 'Task actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(todo);

    await userEvent.click(screen.getByRole('button', { name: 'Task actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(todo);
  });

  it('opens the menu with ArrowDown on the trigger', async () => {
    renderItem();

    screen.getByRole('button', { name: 'Task actions' }).focus();
    await userEvent.keyboard('{ArrowDown}');

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('keeps task content out of data attributes', () => {
    const todo = createTodo({ title: 'Write PIP for Alex', linkedPersonId: ALEX.id });
    const { container } = renderItem(todo, { person: ALEX });

    const serialized = container.innerHTML;
    expect(serialized).not.toMatch(/data-[a-z-]+=/);
    expect(serialized).not.toContain(todo.id);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderItem(
      createTodo({ dueDate: '2026-06-01', linkedPersonId: ALEX.id }),
      { person: ALEX },
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
