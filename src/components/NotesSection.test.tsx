import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { createNote } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { Note } from '../types/Note';
import { NOTE_MAX_LENGTH } from '../data/notes';
import { AUTOSAVE_DELAY_MS, NotesSection } from './NotesSection';
import {
  EncryptedStorageContext,
  EncryptedStorageProvider,
  type EncryptedStorageContextValue,
} from './EncryptedStorageProvider';
import { StorageWriteError } from '../utils/encryptedStorage';
import { ToastProvider } from './Toast';

vi.mock('../utils/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/crypto')>();
  const { fastDeriveKey } = await import('../test-utils/fastCrypto');
  return { ...actual, deriveKey: fastDeriveKey };
});

const MEMBER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const PASSPHRASE = 'correct horse battery staple';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const note = (content: string, hours: number, memberId = MEMBER): Note =>
  createNote({ memberId, content, createdAt: hoursAgo(hours), updatedAt: hoursAgo(hours) });

const renderNotes = (
  notes: Note[] = [],
  privateData: Record<string, unknown> = {},
  memberId = MEMBER,
) =>
  renderWithProviders(<NotesSection memberId={memberId} />, {
    initialPrivateData: { notes, ...privateData },
  });

const textarea = () => screen.findByRole('textbox', { name: '1:1 Notes' });
const saveButton = () => screen.getByRole('button', { name: 'Save Note' });

afterEach(() => {
  vi.useRealTimers();
});

describe('NotesSection', () => {
  it('renders new note textarea with save button', async () => {
    renderNotes();

    expect(await textarea()).toBeInTheDocument();
    expect(saveButton()).toBeInTheDocument();
  });

  it('saving a note adds it to the top of the list', async () => {
    const user = userEvent.setup();
    renderNotes([note('Older note', 48)]);

    await user.type(await textarea(), 'Brand new note');
    await user.click(saveButton());

    const items = within(screen.getByRole('list', { name: '1:1 notes history' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Brand new note');
    expect(items[1]).toHaveTextContent('Older note');
    expect(await textarea()).toHaveValue('');
  });

  it('saving an empty note is prevented', async () => {
    const user = userEvent.setup();
    renderNotes();
    const input = await textarea();

    expect(saveButton()).toBeDisabled();
    await user.type(input, '   ');
    expect(saveButton()).toBeDisabled();
    await user.type(input, 'x');
    expect(saveButton()).toBeEnabled();
  });

  it('blocks saving above the character limit and says by how much', async () => {
    const user = userEvent.setup();
    renderNotes();

    await user.click(await textarea());
    await user.paste('x'.repeat(NOTE_MAX_LENGTH + 3));

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(/3 characters over the limit/)).toBeInTheDocument();
  });

  it('announces how many characters remain near the limit through the describedby link', async () => {
    const user = userEvent.setup();
    renderNotes();

    await user.click(await textarea());
    await user.paste('x'.repeat(NOTE_MAX_LENGTH - 10));

    expect(await textarea()).toHaveAccessibleDescription('9,990 / 10,000. 10 characters remaining');
  });

  describe('search', () => {
    const notes = () => [
      note('Talked about the promotion cycle', 50),
      note('Vacation next week', 30),
      note('PROMOTION packet due Friday', 10),
    ];

    it('search filters notes by content', async () => {
      const user = userEvent.setup();
      renderNotes(notes());

      await user.type(await screen.findByRole('searchbox', { name: 'Search notes' }), 'promotion');

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(2);
      expect(screen.queryByText('Vacation next week')).not.toBeInTheDocument();
    });

    it('search highlights matching text with <mark> element', async () => {
      const user = userEvent.setup();
      renderNotes(notes());

      await user.type(await screen.findByRole('searchbox', { name: 'Search notes' }), 'vacation');

      expect(screen.getByText('Vacation').tagName).toBe('MARK');
    });

    it('search with no results shows "No notes found" message', async () => {
      const user = userEvent.setup();
      renderNotes(notes());

      await user.type(await screen.findByRole('searchbox', { name: 'Search notes' }), 'zzz');

      expect(screen.getByText('No notes found')).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: '1:1 notes history' })).not.toBeInTheDocument();
    });

    it('search announces result count via aria-live', async () => {
      const user = userEvent.setup();
      renderNotes(notes());
      const search = await screen.findByRole('searchbox', { name: 'Search notes' });

      await user.type(search, 'promotion');
      const count = screen.getByText('2 notes found');
      expect(count).toHaveAttribute('aria-live', 'polite');

      await user.clear(search);
      await user.type(search, 'vacation');
      expect(count).toHaveTextContent('1 note found');
    });

    it("searches only the member's own notes and keeps the query out of the URL", async () => {
      const user = userEvent.setup();
      renderNotes([...notes(), note('promotion for someone else', 5, OTHER)]);

      await user.type(await screen.findByRole('searchbox', { name: 'Search notes' }), 'promotion');

      expect(screen.getAllByRole('listitem')).toHaveLength(2);
      expect(window.location.href).not.toContain('promotion');
    });

    it('clears the search after saving so the new note is visible', async () => {
      const user = userEvent.setup();
      renderNotes(notes());
      await user.type(await screen.findByRole('searchbox', { name: 'Search notes' }), 'vacation');

      await user.type(await textarea(), 'Totally different');
      await user.click(saveButton());

      expect(screen.getByRole('searchbox', { name: 'Search notes' })).toHaveValue('');
      expect(screen.getByText('Totally different')).toBeInTheDocument();
    });
  });

  it('character count updates as user types', async () => {
    const user = userEvent.setup();
    renderNotes();
    const input = await textarea();

    expect(screen.getByText('0 / 10,000')).toBeInTheDocument();
    await user.type(input, 'hello');

    expect(screen.getByText('5 / 10,000')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-describedby', screen.getByText('5 / 10,000').id);
  });

  describe('auto-save', () => {
    const setUpFakeTimers = () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    };

    it('auto-save triggers after typing pause', async () => {
      const user = setUpFakeTimers();
      const first = renderNotes();
      await user.type(await textarea(), 'work in progress');

      await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100));
      expect(screen.queryByText('Saved')).not.toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(200));
      await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
      first.unmount();
    });

    it('auto-save status announced via aria-live ("Saving…" / "Saved")', async () => {
      const user = setUpFakeTimers();
      renderNotes();
      await user.type(await textarea(), 'abc');
      const status = screen
        .getAllByRole('status')
        .find((el) => el.classList.contains('notes__status'))!;

      expect(status).toHaveAttribute('aria-live', 'polite');
      await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
      await waitFor(() => expect(status).toHaveTextContent('Saved'));
    });

    it('restores an auto-saved draft the next time the notes open', async () => {
      renderNotes([], { noteDrafts: { [MEMBER]: 'unfinished thought' } });

      expect(await textarea()).toHaveValue('unfinished thought');
    });

    it('typing only schedules one save after the pause, not one per keystroke', async () => {
      const user = setUpFakeTimers();
      renderNotes();
      await user.type(await textarea(), 'abcdef');

      expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
      await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
    });
  });

  it('empty state renders when no notes exist', async () => {
    renderNotes();

    expect(
      await screen.findByText('No notes yet. Add your first 1:1 note above.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('note list renders as ordered list with aria-label', async () => {
    renderNotes([note('one', 3)]);

    const list = await screen.findByRole('list', { name: '1:1 notes history' });
    expect(list.tagName).toBe('OL');
    expect(list).toHaveAttribute('reversed');
    expect(within(list).getByRole('article')).toBeInTheDocument();
  });

  it('after saving, focus returns to textarea and "Note saved" is announced', async () => {
    const user = userEvent.setup();
    renderNotes();

    await user.type(await textarea(), 'hello');
    await user.click(saveButton());

    expect(await textarea()).toHaveFocus();
    expect(screen.getByText('Note saved')).toBeInTheDocument();
  });

  it('shows only the notes of the current member', async () => {
    renderNotes([note('mine', 2), note('theirs', 2, OTHER)]);

    expect(await screen.findByText('mine')).toBeInTheDocument();
    expect(screen.queryByText('theirs')).not.toBeInTheDocument();
  });

  it('lets a recent note be edited and keeps older notes locked', async () => {
    const user = userEvent.setup();
    renderNotes([note('recent one', 1), note('old one', 30)]);

    expect(await screen.findAllByText('Locked')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /^Edit note from / }));
    await user.type(screen.getByRole('textbox', { name: /^Edit note from / }), '!');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('recent one!')).toBeInTheDocument();
    expect(screen.getByText('Edited')).toBeInTheDocument();
  });

  it('has no accessibility violations with notes and a search active', async () => {
    const user = userEvent.setup();
    const { container } = renderNotes([note('## Plan\nfirst', 2), note('second', 40)]);
    await user.type(await screen.findByRole('searchbox', { name: 'Search notes' }), 'first');

    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps the typed text and shows an error when the write fails', async () => {
    const user = userEvent.setup();
    const data = new Map<string, unknown>();
    const storage = {
      isPrivateUnlocked: true,
      loadPrivate: async () => undefined,
      get: () => null,
      getPrivate: <T,>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
      setPrivate: <T,>(key: string, value: T) => void data.set(key, value),
      flush: async () => new StorageWriteError(true, true),
    } as unknown as EncryptedStorageContextValue;
    render(
      <ToastProvider>
        <EncryptedStorageContext.Provider value={storage}>
          <NotesSection memberId={MEMBER} />
        </EncryptedStorageContext.Provider>
      </ToastProvider>,
    );

    await user.type(await textarea(), 'will not land');
    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save your note");
    expect(await textarea()).toHaveValue('will not land');
    expect(screen.queryByRole('list', { name: '1:1 notes history' })).not.toBeInTheDocument();
  });

  it('shows an error when the private notes cannot be opened', async () => {
    const storage = {
      isPrivateUnlocked: false,
      loadPrivate: async () => {
        throw new Error('corrupt');
      },
    } as unknown as EncryptedStorageContextValue;
    render(
      <EncryptedStorageContext.Provider value={storage}>
        <NotesSection memberId={MEMBER} />
      </EncryptedStorageContext.Provider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't open your notes");
  });

  describe('with the real encrypted storage', () => {
    function Harness({ mode }: { mode: 'setup' | 'unlock' }) {
      const { isUnlocked, setup, unlock } = useEncryptedStorage();
      useEffect(() => {
        void (mode === 'setup' ? setup(PASSPHRASE) : unlock(PASSPHRASE));
      }, [mode, setup, unlock]);
      return isUnlocked ? <NotesSection memberId={MEMBER} /> : null;
    }

    const renderReal = (mode: 'setup' | 'unlock') =>
      render(
        <ToastProvider>
          <EncryptedStorageProvider>
            <Harness mode={mode} />
          </EncryptedStorageProvider>
        </ToastProvider>,
      );

    it('notes persist through encrypted storage', async () => {
      const user = userEvent.setup();
      const first = renderReal('setup');
      await user.type(await textarea(), 'Sensitive feedback about the reorg');
      await user.click(saveButton());
      await screen.findByText('Note saved');
      first.unmount();

      const stored = Object.values(window.localStorage).join('');
      expect(stored).not.toContain('Sensitive feedback');

      renderReal('unlock');
      expect(await screen.findByText('Sensitive feedback about the reorg')).toBeInTheDocument();
    });

    it('keeps unsent text as an encrypted draft when leaving the page', async () => {
      const user = userEvent.setup();
      const first = renderReal('setup');
      await user.type(await textarea(), 'half a thought');
      const before = window.localStorage.getItem('crewbook_private');
      first.unmount();
      // The draft write is asynchronous encryption; wait until the private envelope changes.
      await waitFor(() => expect(window.localStorage.getItem('crewbook_private')).not.toBe(before));

      renderReal('unlock');

      await waitFor(async () => expect(await textarea()).toHaveValue('half a thought'));
    });
  });
});
