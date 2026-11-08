import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { NoteLockedError } from '../data/notes';
import { createNote } from '../test-utils/factories';
import type { Note } from '../types/Note';
import { NoteEntry } from './NoteEntry';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const recentNote = (overrides: Partial<Note> = {}) =>
  createNote({ createdAt: hoursAgo(1), updatedAt: hoursAgo(1), ...overrides });
const oldNote = (overrides: Partial<Note> = {}) =>
  createNote({ createdAt: hoursAgo(25), updatedAt: hoursAgo(25), ...overrides });

const renderEntry = (note: Note, onUpdate = vi.fn().mockResolvedValue(undefined), query = '') =>
  render(
    <ol>
      <li>
        <NoteEntry note={note} onUpdate={onUpdate} query={query} />
      </li>
    </ol>,
  );

describe('NoteEntry', () => {
  it('note entry displays date and markdown-rendered content', () => {
    const note = createNote({
      content: '**Great** progress\n\n- ship the API',
      createdAt: new Date(2026, 0, 7, 10, 0).toISOString(),
      updatedAt: new Date(2026, 0, 7, 10, 0).toISOString(),
    });
    renderEntry(note);

    const time = screen.getByText('Wed, Jan 7, 2026 · 10:00 AM');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', note.createdAt);
    expect(screen.getByText('Great').tagName).toBe('STRONG');
    expect(screen.getByText('ship the API').tagName).toBe('LI');
  });

  it('notes within 24h show edit icon', () => {
    renderEntry(recentNote());

    expect(screen.getByRole('button', { name: /^Edit note from / })).toBeInTheDocument();
    expect(screen.queryByText('Locked')).not.toBeInTheDocument();
  });

  it('notes older than 24h show lock indicator instead of edit icon', () => {
    renderEntry(oldNote());

    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit note/ })).not.toBeInTheDocument();
  });

  it('lock indicator has accessible label describing locked state', () => {
    renderEntry(oldNote());

    expect(
      screen.getByRole('img', { name: 'This note is locked and can no longer be edited' }),
    ).toBeInTheDocument();
  });

  it('edit button is visible on keyboard focus, not only on hover', async () => {
    const user = userEvent.setup();
    renderEntry(recentNote());

    await user.tab();

    // CSS is not loaded in jsdom; this proves the button is in the tab order and not hidden.
    const button = screen.getByRole('button', { name: /^Edit note from / });
    expect(button).toHaveFocus();
    expect(button).toBeVisible();
    expect(button).not.toHaveAttribute('tabindex', '-1');
  });

  it('edit button has aria-label "Edit note from [date]"', () => {
    const created = new Date(2026, 0, 7, 15, 5);
    const note = createNote({ createdAt: created.toISOString(), updatedAt: created.toISOString() });
    render(<NoteEntry note={note} now={created.getTime() + 1000} onUpdate={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Edit note from Wed, Jan 7, 2026 · 3:05 PM' }),
    ).toBeInTheDocument();
  });

  it('rendered markdown headings are capped at h4', () => {
    renderEntry(recentNote({ content: '# One\n## Two\n### Three' }));

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(3);
  });

  it('does not execute script or event handlers in note content', () => {
    renderEntry(recentNote({ content: '<img src=x onerror=alert(1)> <script>alert(1)</script>' }));

    expect(document.querySelector('img, script')).toBeNull();
  });

  it('highlights search matches with <mark>', () => {
    renderEntry(recentNote({ content: 'Talked about promotion' }), undefined, 'promo');

    expect(screen.getByText('promo').tagName).toBe('MARK');
  });

  it('shows an Edited marker only after a note has been changed', () => {
    const { unmount } = renderEntry(recentNote());
    expect(screen.queryByText('Edited')).not.toBeInTheDocument();
    unmount();

    renderEntry(recentNote({ updatedAt: new Date().toISOString() }));
    expect(screen.getByText('Edited')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderEntry(recentNote({ content: '## Heading\n[link](https://x.dev)' }));

    expect(await axe(container)).toHaveNoViolations();
  });

  describe('editing', () => {
    it('saves the edited content and returns focus to the edit button', async () => {
      const user = userEvent.setup();
      const note = recentNote({ content: 'before' });
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      renderEntry(note, onUpdate);

      await user.click(screen.getByRole('button', { name: /^Edit note from / }));
      const textarea = screen.getByRole('textbox', { name: /^Edit note from / });
      expect(textarea).toHaveFocus();
      await user.type(textarea, ' after');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(onUpdate).toHaveBeenCalledWith(note.id, 'before after');
      expect(await screen.findByRole('button', { name: /^Edit note from / })).toHaveFocus();
    });

    it('Escape cancels without saving', async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      renderEntry(recentNote({ content: 'keep me' }), onUpdate);

      await user.click(screen.getByRole('button', { name: /^Edit note from / }));
      await user.type(screen.getByRole('textbox'), ' changed{Escape}');

      expect(onUpdate).not.toHaveBeenCalled();
      expect(screen.getByText('keep me')).toBeInTheDocument();
    });

    it('disables Save changes when the text is blank', async () => {
      const user = userEvent.setup();
      renderEntry(recentNote({ content: 'x' }));

      await user.click(screen.getByRole('button', { name: /^Edit note from / }));
      await user.clear(screen.getByRole('textbox'));

      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });

    it('stays in edit mode and shows an error when saving fails', async () => {
      const user = userEvent.setup();
      renderEntry(recentNote({ content: 'x' }), vi.fn().mockRejectedValue(new Error('boom')));

      await user.click(screen.getByRole('button', { name: /^Edit note from / }));
      await user.type(screen.getByRole('textbox'), 'y');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save your changes");
      expect(screen.getByRole('textbox')).toHaveValue('xy');
    });

    it('explains when the note locked while it was being edited', async () => {
      const user = userEvent.setup();
      renderEntry(recentNote({ content: 'x' }), vi.fn().mockRejectedValue(new NoteLockedError()));

      await user.click(screen.getByRole('button', { name: /^Edit note from / }));
      await user.type(screen.getByRole('textbox'), 'y');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('now locked');
    });

    it('shows a character count while editing', async () => {
      const user = userEvent.setup();
      renderEntry(recentNote({ content: 'abc' }));

      await user.click(screen.getByRole('button', { name: /^Edit note from / }));

      expect(within(screen.getByRole('article')).getByText('3 / 10,000')).toBeInTheDocument();
    });
  });
});
