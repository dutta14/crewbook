import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

const renderDialog = (props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <ConfirmDialog
      isOpen
      title="Delete Alex Chen?"
      message="This removes all notes and cannot be undone."
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel, ...utils };
};

describe('ConfirmDialog', () => {
  it('renders an alertdialog described by its message', () => {
    renderDialog();

    expect(
      screen.getByRole('alertdialog', { name: 'Delete Alex Chen?' }),
    ).toHaveAccessibleDescription('This removes all notes and cannot be undone.');
  });

  it('gives the confirm button initial focus', () => {
    renderDialog({ confirmLabel: 'Delete member' });

    expect(screen.getByRole('button', { name: 'Delete member' })).toHaveFocus();
  });

  it('labels the confirm button "Confirm" by default', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('uses the danger variant by default', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveClass('btn-danger');
  });

  it('uses the warning variant when requested', () => {
    renderDialog({ variant: 'warning' });

    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveClass('btn-warning');
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel on Escape', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();

    await user.click(screen.getByRole('alertdialog').parentElement as HTMLElement);

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('renders nothing while closed', () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    renderDialog();

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
