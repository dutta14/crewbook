import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTodo } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { Todos } from './Todos';

describe('Todos page', () => {
  it('shows the heading, moves focus to it, and lists saved tasks', () => {
    renderWithProviders(<Todos />, {
      initialPrivateData: { todos: [createTodo({ title: 'Prep 1:1s' })] },
    });

    const heading = screen.getByRole('heading', { level: 1, name: 'My Tasks' });
    expect(heading).toHaveFocus();
    expect(screen.getByRole('checkbox', { name: 'Prep 1:1s' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Tasks' })).toBeInTheDocument();
  });

  it('shows the empty state when nothing is saved', () => {
    renderWithProviders(<Todos />);

    expect(screen.getByText('All clear! No pending tasks.')).toBeInTheDocument();
  });
});
