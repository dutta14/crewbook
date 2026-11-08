import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../data/errors';
import { createGrowthEntry } from '../test-utils/factories';
import type { GrowthEntryInput } from '../types';
import { GrowthEntryModal } from './GrowthEntryModal';

function Harness({
  onSubmit = vi.fn().mockResolvedValue(undefined),
  onDelete,
  entry,
}: {
  onSubmit?: (values: GrowthEntryInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  entry?: ReturnType<typeof createGrowthEntry>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open form
      </button>
      <GrowthEntryModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={onSubmit}
        entry={entry}
        onDelete={onDelete}
      />
    </>
  );
}

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Open form' }));
  return screen.findByRole('dialog');
};

describe('GrowthEntryModal', () => {
  it('is labelled by its title, modal, and puts focus on the date field', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const dialog = await open(user);

    expect(dialog).toHaveAccessibleName('Add growth entry');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByLabelText(/^Date/)).toHaveFocus();
  });

  it('does not submit without a date and explains why next to the field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSubmit={onSubmit} />);
    const dialog = await open(user);

    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    const date = within(dialog).getByLabelText(/^Date/);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(date).toHaveAttribute('aria-invalid', 'true');
    expect(date).toHaveAccessibleDescription('Enter the date of this change');
    expect(date).toHaveFocus();

    fireEvent.change(date, { target: { value: '2025-01-01' } });
    expect(date).not.toHaveAttribute('aria-invalid');
  });

  it('submits what was typed, with notes autofill turned off', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSubmit={onSubmit} />);
    const dialog = await open(user);

    fireEvent.change(within(dialog).getByLabelText(/^Date/), { target: { value: '2025-02-02' } });
    await user.type(within(dialog).getByLabelText('To'), 'L5');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(within(dialog).getByLabelText('Notes')).toHaveAttribute('autocomplete', 'off');
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        date: '2025-02-02',
        changeType: 'promotion',
        from: '',
        to: 'L5',
        notes: '',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('stays open and shows the message when the store rejects the values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ValidationError('Notes must be 500 characters or fewer'));
    render(<Harness onSubmit={onSubmit} />);
    const dialog = await open(user);

    fireEvent.change(within(dialog).getByLabelText(/^Date/), { target: { value: '2025-02-02' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Notes must be 500 characters or fewer',
    );
  });

  it('stays open without a message when the failure was already toasted', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('disk full'));
    render(<Harness onSubmit={onSubmit} />);
    const dialog = await open(user);

    fireEvent.change(within(dialog).getByLabelText(/^Date/), { target: { value: '2025-02-02' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the button that opened it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Open form' })).toHaveFocus();
  });

  it('closes when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await open(user);

    fireEvent.mouseDown(dialog.parentElement as HTMLElement);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes from Cancel without submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const dialog = await open(user);

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await open(user);
    const save = within(dialog).getByRole('button', { name: 'Save' });

    save.focus();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(within(dialog).getByRole('button', { name: 'Close dialog' })).toHaveFocus();

    await user.tab({ shift: true });
    expect(save).toHaveFocus();
  });

  it('offers Delete only when editing, and starts the form with a clean slate each time', async () => {
    const user = userEvent.setup();
    const entry = createGrowthEntry({ notes: 'Private note' });
    render(<Harness entry={entry} onDelete={vi.fn().mockResolvedValue(undefined)} />);

    const dialog = await open(user);
    expect(dialog).toHaveAccessibleName('Edit growth entry');
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Notes'), ' more');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const reopened = await open(user);
    expect(within(reopened).getByLabelText('Notes')).toHaveValue('Private note');
  });

  it('asks before deleting, in an alert dialog described by the warning', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<Harness entry={createGrowthEntry()} onDelete={onDelete} />);
    const dialog = await open(user);

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveAccessibleDescription(/can't be undone/);
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the form open when the delete fails', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockRejectedValue(new Error('disk full'));
    render(<Harness entry={createGrowthEntry()} onDelete={onDelete} />);
    const dialog = await open(user);

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() => expect(onDelete).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Edit growth entry' })).toBeInTheDocument();
  });
});
