import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../data/errors';
import type { CaptureType } from '../types/LiveSession';
import {
  QuickCapture,
  type CaptureDetails,
  type CaptureOwner,
  type CaptureRequest,
} from './QuickCapture';

function Harness({
  onSubmit,
  owners,
  editorRef,
  initial = null,
}: {
  onSubmit: (type: CaptureType, title: string, details: CaptureDetails) => Promise<void>;
  owners?: CaptureOwner[];
  editorRef?: React.RefObject<HTMLTextAreaElement | null>;
  initial?: CaptureRequest | null;
}) {
  const [active, setActive] = useState<CaptureRequest | null>(initial);
  return (
    <QuickCapture
      active={active}
      onOpen={(type) => setActive((current) => ({ type, nonce: (current?.nonce ?? 0) + 1 }))}
      onClose={() => setActive(null)}
      onSubmit={onSubmit}
      owners={owners}
      editorRef={editorRef}
    />
  );
}

describe('QuickCapture', () => {
  it('offers a labelled, collapsed button for each kind of capture', () => {
    render(<Harness onSubmit={vi.fn()} />);

    for (const name of ['Add action item', 'Add decision', 'Add follow-up']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('opens a form with the title input focused when a button is pressed', async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Add decision' }));

    expect(screen.getByRole('form', { name: 'New decision' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Decision title' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Add decision' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('submits the title with Enter, closes the form and returns focus to the editor', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const editorRef = createRef<HTMLTextAreaElement>();
    render(
      <>
        <textarea ref={editorRef} aria-label="Editor" />
        <Harness onSubmit={onSubmit} editorRef={editorRef} />
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Add follow-up' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Follow-up title' }),
      'Check in Friday{Enter}',
    );

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('followup', 'Check in Friday', {
      ownerId: 'manager',
      dueDate: '',
    });
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Editor' })).toHaveFocus();
  });

  it('asks for a title instead of submitting an empty one', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Add action item' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a title for this action item');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Action item title' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('stays open and shows the message when the submit is rejected', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValueOnce(new ValidationError('Your notes are full.'));
    render(<Harness onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Add action item' }));
    await user.type(screen.getByRole('textbox', { name: 'Action item title' }), 'Ship it{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Your notes are full.');
    expect(screen.getByRole('textbox', { name: 'Action item title' })).toHaveValue('Ship it');
  });

  it('shows a generic message for an unexpected failure', async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn().mockRejectedValue(new Error('disk'))} />);

    await user.click(screen.getByRole('button', { name: 'Add action item' }));
    await user.type(screen.getByRole('textbox', { name: 'Action item title' }), 'x{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't add that. Try again.");
  });

  it('closes on Escape and moves focus back to the button that opened it', async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Add decision' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add decision' })).toHaveFocus();
  });

  it('closes with the Cancel button', async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Add action item' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('has no accessibility violations with a form open', async () => {
    const { container } = render(
      <Harness onSubmit={vi.fn()} initial={{ type: 'action', nonce: 1 }} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
