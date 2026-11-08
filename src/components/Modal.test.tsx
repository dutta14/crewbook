import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

function Harness({ closeOnBackdrop }: { closeOnBackdrop?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open modal
      </button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Edit member"
        closeOnBackdrop={closeOnBackdrop}
      >
        <label>
          Name
          <input type="text" />
        </label>
        <button type="button">Save</button>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing while closed', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Hidden">
        Body
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders an accessible dialog labelled by its title in a portal on document.body', () => {
    const { container } = render(
      <Modal isOpen onClose={vi.fn()} title="Edit member">
        Body
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Edit member' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(container).not.toContainElement(dialog);
    expect(document.body).toContainElement(dialog);
  });

  it('supports the alertdialog role and a description', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Delete" role="alertdialog" describedBy="why">
        <p id="why">This cannot be undone.</p>
      </Modal>,
    );

    expect(screen.getByRole('alertdialog', { name: 'Delete' })).toHaveAccessibleDescription(
      'This cannot be undone.',
    );
  });

  it('applies the requested size variant', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Wide" size="lg">
        Body
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toHaveClass('modal--lg');
  });

  it('renders the footer when provided', () => {
    render(
      <Modal
        isOpen
        onClose={vi.fn()}
        title="With footer"
        footer={<button type="button">Done</button>}
      >
        Body
      </Modal>,
    );

    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('moves focus to the first focusable element in the body when opened', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
  });

  it('focuses the close button when the body has nothing focusable', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Info">
        Just text
      </Modal>,
    );

    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Info">
        Body
      </Modal>,
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Info">
        Body
      </Modal>,
    );

    await user.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Info">
        Body
      </Modal>,
    );

    await user.click(screen.getByRole('dialog').parentElement as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when content inside the dialog is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Info">
        <p>Body text</p>
      </Modal>,
    );

    await user.click(screen.getByText('Body text'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores backdrop clicks when closeOnBackdrop is false', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Info" closeOnBackdrop={false}>
        Body
      </Modal>,
    );

    await user.click(screen.getByRole('dialog').parentElement as HTMLElement);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps Tab focus inside the dialog by wrapping from last to first', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    screen.getByRole('button', { name: 'Save' }).focus();

    await user.tab();

    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
  });

  it('keeps Shift+Tab focus inside the dialog by wrapping from first to last', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open modal' }));
    screen.getByRole('button', { name: 'Close dialog' }).focus();

    await user.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('returns focus to the trigger when closed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open modal' });
    await user.click(trigger);

    await user.keyboard('{Escape}');

    expect(trigger).toHaveFocus();
  });

  it('keeps the dialog out of the accessibility tree while it plays its exit transition, then unmounts it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Edit member')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Edit member')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    vi.useRealTimers();
    render(
      <Modal isOpen onClose={vi.fn()} title="Edit member">
        <label>
          Name
          <input type="text" />
        </label>
      </Modal>,
    );

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
