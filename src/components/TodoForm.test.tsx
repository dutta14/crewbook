import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../data/errors';
import { createMember, createTodo } from '../test-utils/factories';
import { TodoForm, type TodoFormProps } from './TodoForm';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

/** Owns the open state, like the list does, so focus return can be observed. */
function Harness(props: Partial<TodoFormProps>) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        + Add task
      </button>
      <TodoForm
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        members={[ALEX, PRIYA]}
        {...props}
      />
    </>
  );
}

const open = async (props: Partial<TodoFormProps> = {}) => {
  const user = userEvent.setup();
  const result = render(<Harness {...props} />);
  await user.click(screen.getByRole('button', { name: '+ Add task' }));
  return { user, ...result };
};

describe('TodoForm', () => {
  it('opens a modal dialog named by its title', async () => {
    await open();

    const dialog = screen.getByRole('dialog', { name: 'Add task' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(screen.getByRole('textbox', { name: /Title/ })).toHaveFocus();
  });

  it('keeps focus inside the dialog when tabbing past the last control', async () => {
    const { user } = await open();
    const dialog = screen.getByRole('dialog');
    screen.getByRole('button', { name: 'Save' }).focus();

    await user.tab();

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the button that opened it', async () => {
    const { user } = await open();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '+ Add task' })).toHaveFocus();
  });

  it('closes on Cancel without saving', async () => {
    const onSubmit = vi.fn();
    const { user } = await open({ onSubmit });
    await user.type(screen.getByRole('textbox', { name: /Title/ }), 'Draft');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits every field and closes the dialog', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { user } = await open({ onSubmit });

    await user.type(screen.getByRole('textbox', { name: /Title/ }), 'Write promo packet');
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Gather examples');
    await user.type(screen.getByLabelText('Due date'), '2026-07-01');
    await user.selectOptions(screen.getByLabelText('Priority'), 'high');
    await user.selectOptions(screen.getByLabelText('Status'), 'in_progress');
    await user.selectOptions(screen.getByLabelText('Linked person'), PRIYA.id);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Write promo packet',
      description: 'Gather examples',
      dueDate: '2026-07-01',
      priority: 'high',
      status: 'in_progress',
      linkedPersonId: PRIYA.id,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows a validation error and refocuses the title when it is empty', async () => {
    const onSubmit = vi.fn();
    const { user } = await open({ onSubmit });
    await user.type(screen.getByRole('textbox', { name: /Title/ }), '   ');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const title = screen.getByRole('textbox', { name: /Title/ });
    expect(screen.getByText('Enter a title for this task')).toBeInTheDocument();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription('Enter a title for this task');
    expect(title).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears the title error as soon as the user types', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await user.type(screen.getByRole('textbox', { name: /Title/ }), 'a');

    expect(screen.queryByText('Enter a title for this task')).not.toBeInTheDocument();
  });

  it('keeps the dialog open and shows the message when the data layer rejects the input', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ValidationError('Due date is not a valid date'));
    const { user } = await open({ onSubmit });
    await user.type(screen.getByRole('textbox', { name: /Title/ }), 'Task');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Due date is not a valid date');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps the dialog open and the input intact when saving fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('write failed'));
    const { user } = await open({ onSubmit });
    await user.type(screen.getByRole('textbox', { name: /Title/ }), 'Task');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Title/ })).toHaveValue('Task');
  });

  it('pre-fills the form when editing', async () => {
    await open({
      todo: createTodo({
        title: 'Existing task',
        description: 'Some notes',
        dueDate: '2026-08-09',
        priority: 'low',
        status: 'done',
        linkedPersonId: ALEX.id,
      }),
    });

    expect(screen.getByRole('dialog', { name: 'Edit task' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Title/ })).toHaveValue('Existing task');
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Some notes');
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-08-09');
    expect(screen.getByLabelText('Priority')).toHaveValue('low');
    expect(screen.getByLabelText('Status')).toHaveValue('done');
    expect(screen.getByLabelText('Linked person')).toHaveValue(ALEX.id);
  });

  it('turns off autofill on every field', async () => {
    await open();
    const dialog = screen.getByRole('dialog');

    const fields = dialog.querySelectorAll('input, textarea, select');
    expect(fields.length).toBe(6);
    fields.forEach((field) => expect(field).toHaveAttribute('autocomplete', 'off'));
    expect(dialog.querySelector('form')).toHaveAttribute('autocomplete', 'off');
  });

  it('uses ids, not names, as the values of the person options', async () => {
    await open();

    const values = Array.from(
      (screen.getByLabelText('Linked person') as HTMLSelectElement).options,
    ).map((option) => option.value);
    expect(values).toEqual(['', ALEX.id, PRIYA.id]);
  });

  it('removes what was typed from the DOM when it closes, and starts empty next time', async () => {
    const { user } = await open();
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Highly sensitive text');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.body.innerHTML).not.toContain('Highly sensitive text'));
    await user.click(screen.getByRole('button', { name: '+ Add task' }));
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('');
  });

  it('has no accessibility violations', async () => {
    await open();

    expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations();
  });
});
