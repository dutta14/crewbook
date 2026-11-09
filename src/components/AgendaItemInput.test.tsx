import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ValidationError } from '../data/errors';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { AgendaItemInput } from './AgendaItemInput';

const renderInput = (onAdd = vi.fn(async () => undefined)) => {
  const view = renderWithProviders(<AgendaItemInput memberName="Alex Chen" onAdd={onAdd} />);
  return { ...view, onAdd, user: userEvent.setup() };
};

describe('AgendaItemInput', () => {
  it('passes the text and who added it, then clears the field', async () => {
    const { user, onAdd } = renderInput();
    const input = screen.getByRole('textbox', { name: 'Add an agenda item' });

    await user.type(input, 'Promo timeline{Enter}');

    expect(onAdd).toHaveBeenCalledWith('Promo timeline', 'manager');
    await waitFor(() => expect(input).toHaveValue(''));
    expect(input).toHaveFocus();
  });

  it('reports a validation error next to the field and keeps the text', async () => {
    const onAdd = vi.fn(async () => {
      throw new ValidationError('Agenda item must not be empty');
    });
    const { user } = renderInput(onAdd);
    const input = screen.getByRole('textbox', { name: 'Add an agenda item' });

    await user.type(input, 'x{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Agenda item must not be empty');
    expect(input).toHaveValue('x');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps the text without a message when the save failed elsewhere', async () => {
    const onAdd = vi.fn(async () => {
      throw new Error('disk');
    });
    const { user } = renderInput(onAdd);
    const input = screen.getByRole('textbox', { name: 'Add an agenda item' });

    await user.type(input, 'x{Enter}');

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(input).toHaveValue('x');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderInput();

    expect(await axe(container)).toHaveNoViolations();
  });
});
