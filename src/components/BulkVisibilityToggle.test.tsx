import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import type { NoteVisibility } from '../types/Note';
import { BulkVisibilityToggle } from './BulkVisibilityToggle';

const notes = (...visibilities: NoteVisibility[]) =>
  visibilities.map((visibility) => ({ visibility }));

const renderBulk = (list: ReturnType<typeof notes>, onSetAll = vi.fn()) => {
  const user = userEvent.setup();
  const view = render(
    <BulkVisibilityToggle notes={list} engineerName="Alex Chen" onSetAll={onSetAll} />,
  );
  return { user, onSetAll, ...view };
};

const shareAll = () => screen.getByRole('button', { name: /^Make all shared/ });
const privateAll = () => screen.getByRole('button', { name: /^Make all private/ });

describe('BulkVisibilityToggle', () => {
  it('asks with the number of notes that would change before sharing them all', async () => {
    const { user, onSetAll } = renderBulk(notes('private', 'private', 'shared'));

    await user.click(shareAll());

    const dialog = await screen.findByRole('alertdialog', { name: 'Share 2 notes?' });
    expect(dialog).toHaveTextContent('2 notes will become visible to Alex Chen.');
    expect(onSetAll).not.toHaveBeenCalled();
  });

  it('shares everything only after the confirmation', async () => {
    const { user, onSetAll } = renderBulk(notes('private', 'private'));

    await user.click(shareAll());
    await user.click(await screen.findByRole('button', { name: 'Share Notes' }));

    expect(onSetAll).toHaveBeenCalledWith('shared');
  });

  it('shares nothing when the confirmation is cancelled', async () => {
    const { user, onSetAll } = renderBulk(notes('private'));

    await user.click(shareAll());
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onSetAll).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('makes everything private straight away without asking', async () => {
    const { user, onSetAll } = renderBulk(notes('shared', 'private'));

    await user.click(privateAll());

    expect(onSetAll).toHaveBeenCalledWith('private');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does nothing, and is marked unavailable, when every note is already shared', async () => {
    const { user, onSetAll } = renderBulk(notes('shared', 'shared'));

    expect(shareAll()).toHaveAttribute('aria-disabled', 'true');
    await user.click(shareAll());

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onSetAll).not.toHaveBeenCalled();
  });

  it('does nothing, and is marked unavailable, when every note is already private', async () => {
    const { user, onSetAll } = renderBulk(notes('private'));

    expect(privateAll()).toHaveAttribute('aria-disabled', 'true');
    await user.click(privateAll());

    expect(onSetAll).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderBulk(notes('private', 'shared'));

    expect(await axe(container)).toHaveNoViolations();
  });
});
