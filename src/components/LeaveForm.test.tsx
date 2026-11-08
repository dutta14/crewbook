import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../data/errors';
import { createLeave, createMember } from '../test-utils/factories';
import { LeaveForm, type LeaveFormProps } from './LeaveForm';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

function setup(props: Partial<LeaveFormProps> = {}) {
  const onSubmit = vi.fn<LeaveFormProps['onSubmit']>().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <LeaveForm
      isOpen
      onClose={onClose}
      onSubmit={onSubmit}
      members={[ALEX, PRIYA]}
      defaultDate="2026-06-15"
      {...props}
    />,
  );
  return { onSubmit, onClose, user: userEvent.setup() };
}

describe('LeaveForm', () => {
  it('opens as Add Leave with the default dates and PTO selected', () => {
    setup();

    expect(screen.getByRole('dialog', { name: 'Add Leave' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Start/)).toHaveValue('2026-06-15');
    expect(screen.getByLabelText(/End/)).toHaveValue('2026-06-15');
    expect(screen.getByLabelText('Type')).toHaveValue('pto');
    expect(screen.getByLabelText(/Person/)).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('offers the four leave types', () => {
    setup();

    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual([
      'Select a person',
      'Alex Chen',
      'Priya Nair',
      'PTO',
      'Sick',
      'Personal',
      'Parental',
    ]);
  });

  it('submits the chosen values and closes', async () => {
    const { user, onSubmit, onClose } = setup();

    await user.selectOptions(screen.getByLabelText(/Person/), 'Priya Nair');
    await user.selectOptions(screen.getByLabelText('Type'), 'Parental');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith({
      memberId: PRIYA.id,
      type: 'parental',
      startDate: '2026-06-15',
      endDate: '2026-06-15',
    });
  });

  it('requires a person and focuses the field', async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const person = screen.getByLabelText(/Person/);
    expect(screen.getByText('Choose who is out')).toBeInTheDocument();
    expect(person).toHaveAttribute('aria-invalid', 'true');
    expect(person).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires both dates', async () => {
    const { user, onSubmit } = setup();
    await user.selectOptions(screen.getByLabelText(/Person/), 'Alex Chen');

    await user.clear(screen.getByLabelText(/End/));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter an end date')).toBeInTheDocument();
    expect(screen.getByLabelText(/End/)).toHaveFocus();

    await user.clear(screen.getByLabelText(/Start/));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a start date')).toBeInTheDocument();
    expect(screen.getByLabelText(/Start/)).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('moves the end along with the start and rejects an end before the start', async () => {
    const { user, onSubmit } = setup();
    await user.selectOptions(screen.getByLabelText(/Person/), 'Alex Chen');

    await user.clear(screen.getByLabelText(/Start/));
    await user.type(screen.getByLabelText(/Start/), '2026-06-20');
    expect(screen.getByLabelText(/End/)).toHaveValue('2026-06-20');

    await user.clear(screen.getByLabelText(/End/));
    await user.type(screen.getByLabelText(/End/), '2026-06-19');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText("End date can't be before the start date")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps a later end when the start moves earlier', async () => {
    const { user } = setup({
      entry: createLeave({ memberId: ALEX.id, startDate: '2026-06-16', endDate: '2026-06-19' }),
    });

    await user.clear(screen.getByLabelText(/Start/));
    await user.type(screen.getByLabelText(/Start/), '2026-06-15');

    expect(screen.getByLabelText(/End/)).toHaveValue('2026-06-19');
  });

  it('pre-fills an entry for editing and offers Delete', async () => {
    const entry = createLeave({
      memberId: ALEX.id,
      type: 'sick',
      startDate: '2026-06-16',
      endDate: '2026-06-18',
    });
    const onRequestDelete = vi.fn();
    const { user, onSubmit } = setup({ entry, onRequestDelete });

    expect(screen.getByRole('dialog', { name: 'Edit Leave' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Person/)).toHaveValue(ALEX.id);
    expect(screen.getByLabelText('Type')).toHaveValue('sick');
    expect(screen.getByLabelText(/Start/)).toHaveValue('2026-06-16');
    expect(screen.getByLabelText(/End/)).toHaveValue('2026-06-18');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onRequestDelete).toHaveBeenCalledWith(entry);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows a validation error from the data layer and stays open', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ValidationError('Person must be on your team'));
    const { user, onClose } = setup({ onSubmit });
    await user.selectOptions(screen.getByLabelText(/Person/), 'Alex Chen');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Person must be on your team');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stays open without an inline error when saving fails for another reason', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('disk'));
    const { user, onClose } = setup({ onSubmit });
    await user.selectOptions(screen.getByLabelText(/Person/), 'Alex Chen');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Cancel', async () => {
    const { user, onClose } = setup();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('has no accessibility violations, including with errors showing', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
