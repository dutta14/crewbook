import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import type { NoteVisibility } from '../types/Note';
import { NoteVisibilityToggle } from './NoteVisibilityToggle';

const renderToggle = (visibility: NoteVisibility, onToggle = vi.fn()) => {
  const user = userEvent.setup();
  const view = render(
    <NoteVisibilityToggle
      noteId="n1"
      visibility={visibility}
      engineerName="Alex Chen"
      onToggle={onToggle}
    />,
  );
  return { user, onToggle, ...view };
};

const toggle = (visibility: NoteVisibility) =>
  screen.getByRole('button', { name: `Toggle note visibility, currently ${visibility}` });

describe('NoteVisibilityToggle', () => {
  it('says a private note is private and not pressed', () => {
    renderToggle('private');

    expect(toggle('private')).toHaveAttribute('aria-pressed', 'false');
    expect(toggle('private')).toHaveAttribute('title', 'Private — only you can see this');
  });

  it('says a shared note is shared with the person, and pressed', () => {
    renderToggle('shared');

    expect(toggle('shared')).toHaveAttribute('aria-pressed', 'true');
    expect(toggle('shared')).toHaveAttribute('title', 'Shared with Alex Chen');
  });

  it('asks before sharing a private note and shares nothing yet', async () => {
    const { user, onToggle } = renderToggle('private');

    await user.click(toggle('private'));

    const dialog = await screen.findByRole('alertdialog', { name: 'Share this note?' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'This note will become visible to Alex Chen.',
    );
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('starts focus on Cancel so pressing Enter straight away shares nothing', async () => {
    const { user, onToggle } = renderToggle('private');

    await user.click(toggle('private'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shares the note only after Share Note is chosen', async () => {
    const { user, onToggle } = renderToggle('private');

    await user.click(toggle('private'));
    await user.click(await screen.findByRole('button', { name: 'Share Note' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('n1', 'shared');
  });

  it('treats Escape as Cancel and returns focus to the toggle', async () => {
    const { user, onToggle } = renderToggle('private');

    await user.click(toggle('private'));
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');

    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(toggle('private')).toHaveFocus();
  });

  it('does not close the dialog or share when the backdrop is clicked', async () => {
    const { user, onToggle } = renderToggle('private');

    await user.click(toggle('private'));
    const dialog = await screen.findByRole('alertdialog');
    const backdrop = dialog.parentElement as HTMLElement;
    await user.click(backdrop);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('makes a shared note private straight away without asking', async () => {
    const { user, onToggle } = renderToggle('shared');

    await user.click(toggle('shared'));

    expect(onToggle).toHaveBeenCalledWith('n1', 'private');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('has no accessibility violations with the dialog open', async () => {
    const { user, container } = renderToggle('private');

    await user.click(toggle('private'));
    await screen.findByRole('alertdialog');

    expect(await axe(document.body)).toHaveNoViolations();
    expect(await axe(container)).toHaveNoViolations();
  });
});
