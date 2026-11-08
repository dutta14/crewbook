import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../data/errors';
import { createMember } from '../test-utils/factories';
import { ReminderForm, type ReminderFormProps } from './ReminderForm';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

/** Owns the open state, like its callers do, so focus return can be observed. */
function Harness(props: Partial<ReminderFormProps>) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Add reminder
      </button>
      <ReminderForm
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        members={[ALEX, PRIYA]}
        {...props}
      />
    </>
  );
}

const open = async (props: Partial<ReminderFormProps> = {}) => {
  const user = userEvent.setup();
  const result = render(<Harness {...props} />);
  await user.click(screen.getByRole('button', { name: 'Add reminder' }));
  return { user, ...result };
};

const textbox = () => screen.getByRole('textbox', { name: /Reminder/ });

describe('ReminderForm', () => {
  it('opens a modal dialog titled New Reminder and focuses the text', async () => {
    await open({ person: ALEX });

    const dialog = screen.getByRole('dialog', { name: 'New Reminder' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(textbox()).toHaveFocus();
    expect(textbox()).toBeRequired();
    expect(textbox()).toHaveAttribute('maxlength', '500');
  });

  it('shows the person read-only when opened from their profile', async () => {
    await open({ person: ALEX });

    const field = screen.getByLabelText('Linked person');
    expect(field).toHaveValue('Alex Chen');
    expect(field).toHaveAttribute('readonly');
  });

  it('offers the team to choose from when no person is given, with ids as values', async () => {
    await open();

    const values = Array.from(
      (screen.getByLabelText('Linked person') as HTMLSelectElement).options,
    ).map((option) => option.value);
    expect(values).toEqual(['', ALEX.id, PRIYA.id]);
  });

  it('starts on the given person and text', async () => {
    await open({ initialPersonId: PRIYA.id, initialText: 'Follow up on promo packet' });

    expect(screen.getByLabelText('Linked person')).toHaveValue(PRIYA.id);
    expect(textbox()).toHaveValue('Follow up on promo packet');
  });

  it('groups the trigger types in a radio group that defaults to before the next 1:1', async () => {
    await open({ person: ALEX });

    expect(screen.getByRole('radiogroup', { name: 'Reminder trigger type' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Before next 1:1' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'On a specific date' })).not.toBeChecked();
    expect(screen.queryByLabelText('Date')).not.toBeInTheDocument();
  });

  it('reveals a date field with a format hint when a specific date is chosen', async () => {
    const { user } = await open({ person: ALEX });

    await user.click(screen.getByRole('radio', { name: 'On a specific date' }));

    const date = screen.getByLabelText('Date');
    expect(date).toHaveAttribute('type', 'date');
    expect(date).toHaveAttribute('min');
    expect(date).toHaveAccessibleDescription('Format: MM/DD/YYYY');
  });

  it('submits a before-next-1:1 reminder and closes the dialog', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { user } = await open({ person: ALEX, onSubmit });

    await user.type(textbox(), 'Ask about the offsite');
    await user.click(screen.getByRole('button', { name: 'Save reminder' }));

    expect(onSubmit).toHaveBeenCalledWith({
      text: 'Ask about the offsite',
      linkedPersonId: ALEX.id,
      triggerType: 'next_1on1',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Add reminder' })).toHaveFocus();
  });

  it('submits a date reminder with the chosen person and date', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { user } = await open({ onSubmit });

    await user.type(textbox(), 'Send congratulations');
    await user.selectOptions(screen.getByLabelText('Linked person'), PRIYA.id);
    await user.click(screen.getByRole('radio', { name: 'On a specific date' }));
    await user.type(screen.getByLabelText('Date'), '2099-03-04');
    await user.click(screen.getByRole('button', { name: 'Save reminder' }));

    expect(onSubmit).toHaveBeenCalledWith({
      text: 'Send congratulations',
      linkedPersonId: PRIYA.id,
      triggerType: 'specific_date',
      triggerDate: '2099-03-04',
    });
  });

  it('asks for text and refocuses the field when it is empty', async () => {
    const onSubmit = vi.fn();
    const { user } = await open({ person: ALEX, onSubmit });
    await user.type(textbox(), '   ');

    await user.click(screen.getByRole('button', { name: 'Save reminder' }));

    expect(screen.getByText('Enter a reminder')).toBeInTheDocument();
    expect(textbox()).toHaveAttribute('aria-invalid', 'true');
    expect(textbox()).toHaveAccessibleDescription('Enter a reminder');
    expect(textbox()).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears the text error as soon as the user types', async () => {
    const { user } = await open({ person: ALEX });
    await user.click(screen.getByRole('button', { name: 'Save reminder' }));

    await user.type(textbox(), 'a');

    expect(screen.queryByText('Enter a reminder')).not.toBeInTheDocument();
  });

  it('asks who the reminder is about when no person is chosen', async () => {
    const onSubmit = vi.fn();
    const { user } = await open({ onSubmit });
    await user.type(textbox(), 'Something');

    await user.click(screen.getByRole('button', { name: 'Save reminder' }));

    expect(screen.getByText('Choose who this is about')).toBeInTheDocument();
    expect(screen.getByLabelText('Linked person')).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('asks for a date when a specific date is chosen without one', async () => {
    const onSubmit = vi.fn();
    const { user } = await open({ person: ALEX, onSubmit });
    await user.type(textbox(), 'Something');
    await user.click(screen.getByRole('radio', { name: 'On a specific date' }));

    await user.click(screen.getByRole('button', { name: 'Save reminder' }));

    expect(screen.getByText('Choose a date')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a date in the past', async () => {
    const onSubmit = vi.fn();
    const { user } = await open({ person: ALEX, onSubmit });
    await user.type(textbox(), 'Something');
    await user.click(screen.getByRole('radio', { name: 'On a specific date' }));
    await user.type(screen.getByLabelText('Date'), '2000-01-01');

    await user.click(screen.getByRole('button', { name: 'Save reminder' }));

    expect(screen.getByText('Date must be in the future')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveAccessibleDescription(
      'Format: MM/DD/YYYY Date must be in the future',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and shows the message when the data layer rejects the input', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ValidationError('Linked person must be on your team'));
    const { user } = await open({ person: ALEX, onSubmit });
    await user.type(textbox(), 'Something');

    await user.click(screen.getByRole('button', { name: 'Save reminder' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Linked person must be on your team',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps the dialog open and the input intact when saving fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('write failed'));
    const { user } = await open({ person: ALEX, onSubmit });
    await user.type(textbox(), 'Something');

    await user.click(screen.getByRole('button', { name: 'Save reminder' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(textbox()).toHaveValue('Something');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes on Escape and on Cancel without saving', async () => {
    const onSubmit = vi.fn();
    const { user } = await open({ person: ALEX, onSubmit });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Add reminder' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Add reminder' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('removes what was typed from the DOM on close and starts empty next time', async () => {
    const { user } = await open({ person: ALEX });
    await user.type(textbox(), 'Confidential concern');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(document.body.innerHTML).not.toContain('Confidential concern'));
    await user.click(screen.getByRole('button', { name: 'Add reminder' }));
    expect(textbox()).toHaveValue('');
  });

  it('turns off autofill on every field', async () => {
    const { user } = await open({ person: ALEX });
    await user.click(screen.getByRole('radio', { name: 'On a specific date' }));

    const dialog = screen.getByRole('dialog');
    dialog
      .querySelectorAll('textarea, select, input[type="text"], input[type="date"]')
      .forEach((field) => expect(field).toHaveAttribute('autocomplete', 'off'));
    expect(dialog.querySelector('form')).toHaveAttribute('autocomplete', 'off');
  });

  it('has no accessibility violations', async () => {
    const { user } = await open({ person: ALEX });
    await user.click(screen.getByRole('radio', { name: 'On a specific date' }));

    expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations();
  });
});
