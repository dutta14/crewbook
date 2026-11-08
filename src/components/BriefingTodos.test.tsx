import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { BriefingTodo } from '../types/briefing';
import { BriefingTodos } from './BriefingTodos';

const todo = (overrides: Partial<BriefingTodo> = {}): BriefingTodo => ({
  id: 't1',
  title: 'Send feedback',
  priority: 'high',
  status: 'todo',
  ...overrides,
});

const renderTodos = (todos: BriefingTodo[], onToggle = vi.fn().mockResolvedValue(undefined)) => {
  const result = renderWithProviders(
    <Routes>
      <Route path="/" element={<BriefingTodos todos={todos} onToggle={onToggle} />} />
      <Route path="/tasks" element={<p>Tasks page</p>} />
    </Routes>,
  );
  return { ...result, onToggle };
};

describe('BriefingTodos', () => {
  it('shows each task with its priority and links to the task list', async () => {
    const user = userEvent.setup();
    renderTodos([todo()]);

    const link = screen.getByRole('link', { name: /Send feedback/ });
    expect(link).toHaveTextContent('High');
    await user.click(link);

    expect(screen.getByText('Tasks page')).toBeInTheDocument();
  });

  it('names the checkbox after the task and asks to toggle it', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderTodos([todo()]);

    await user.click(screen.getByRole('checkbox', { name: 'Send feedback' }));

    expect(onToggle).toHaveBeenCalledWith('t1');
  });

  it('shows a finished task ticked', () => {
    renderTodos([todo({ status: 'done' })]);

    expect(screen.getByRole('checkbox', { name: 'Send feedback' })).toBeChecked();
  });

  it('leaves the box as it was when saving fails', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderTodos([todo()], vi.fn().mockRejectedValue(new Error('nope')));

    await user.click(screen.getByRole('checkbox', { name: 'Send feedback' }));

    expect(onToggle).toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Send feedback' })).not.toBeChecked();
  });

  it('says so when nothing is due', () => {
    renderTodos([]);

    expect(
      within(screen.getByRole('region', { name: 'Action Items' })).getByText('Nothing due today'),
    ).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderTodos([todo(), todo({ id: 't2', title: 'Plan offsite' })]);

    expect(await axe(container)).toHaveNoViolations();
  });
});
