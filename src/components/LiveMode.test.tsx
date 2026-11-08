import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTE_MAX_LENGTH } from '../data/notes';
import { createActionItem, createMember, createNote } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { LiveSession } from '../types/LiveSession';
import type { Note } from '../types/Note';
import { AUTOSAVE_DELAY_MS } from '../hooks/useAutoSave';
import { LiveMode } from './LiveMode';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { listByMember } from '../data/actionItems';

const ALEX = createMember({ id: '11111111-1111-4111-8111-111111111111', name: 'Alex Chen' });
const SETTINGS_SEEN = { settings: { liveModeNoticeDismissed: 'true' } };

function StoredItems({ memberId }: { memberId: string }) {
  const storage = useEncryptedStorage();
  return (
    <ul aria-label="Stored action items">
      {listByMember(memberId, storage).map((item) => (
        <li key={item.id}>{`${item.title} (${item.status})`}</li>
      ))}
    </ul>
  );
}

function Host({ onEnd = vi.fn() }: { onEnd?: (session: LiveSession, note: Note) => void }) {
  const [isLive, setIsLive] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsLive(true)}>
        Start 1:1
      </button>
      {isLive ? (
        <LiveMode
          memberId={ALEX.id}
          memberName={ALEX.name}
          onEnd={(session, note) => {
            setIsLive(false);
            onEnd(session, note);
          }}
        />
      ) : null}
      <StoredItems memberId={ALEX.id} />
    </>
  );
}

interface Options {
  onEnd?: (session: LiveSession, note: Note) => void;
  data?: Record<string, unknown>;
  privateData?: Record<string, unknown>;
}

async function openLive({ onEnd, data = {}, privateData = {} }: Options = {}) {
  const user = userEvent.setup();
  renderWithProviders(<Host onEnd={onEnd} />, {
    initialData: { members: [ALEX], ...SETTINGS_SEEN, ...data },
    initialPrivateData: privateData,
  });
  await user.click(screen.getByRole('button', { name: 'Start 1:1' }));
  return user;
}

const reduceMotion = () =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );

describe('LiveMode', () => {
  beforeEach(reduceMotion);
  afterEach(() => vi.useRealTimers());

  it('opens as a modal dialog labelled with the person and puts focus in the notes', async () => {
    await openLive();

    const dialog = screen.getByRole('dialog', { name: '1:1 with Alex Chen' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      within(dialog).getByRole('heading', { level: 2, name: 'Alex Chen' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '1:1 notes' })).toHaveFocus();
  });

  it('starts the timer at 0:00 without announcing every tick', async () => {
    await openLive();

    const timer = screen.getByRole('timer');
    expect(timer).toHaveTextContent('0:00');
    expect(timer).toHaveAttribute('aria-live', 'off');
  });

  it('keeps Tab inside the overlay, wrapping at both ends', async () => {
    const user = await openLive();
    const end = screen.getByRole('button', { name: 'End 1:1 meeting and save' });

    end.focus();
    await user.tab();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).not.toBe(end);

    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('does not close on Escape', async () => {
    const user = await openLive();

    await user.keyboard('{Escape}');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows open action items and the last notes, truncated to 200 characters', async () => {
    const long = `${'a'.repeat(199)}b${'c'.repeat(50)}`;
    const user = await openLive({
      privateData: {
        notes: [createNote({ memberId: ALEX.id, content: long })],
        actionItems: [
          createActionItem({ memberId: ALEX.id, title: 'Share the design doc' }),
          createActionItem({ memberId: ALEX.id, title: 'Already finished', status: 'done' }),
        ],
      },
    });

    const sidebar = screen.getByRole('complementary', { name: '1:1 context' });
    expect(within(sidebar).getByRole('checkbox', { name: 'Share the design doc' })).toBeVisible();
    expect(within(sidebar).queryByText('Already finished')).not.toBeInTheDocument();
    expect(within(sidebar).getByText(`${'a'.repeat(199)}b…`)).toBeInTheDocument();

    await user.click(within(sidebar).getByRole('button', { name: 'Show more' }));
    expect(within(sidebar).getByText(long)).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('shows empty states when there is nothing from earlier 1:1s', async () => {
    await openLive();

    expect(screen.getByText('Nothing open from earlier 1:1s.')).toBeInTheDocument();
    expect(screen.getByText('No earlier notes yet.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Prep prompts' })).toBeInTheDocument();
  });

  it('marks an action item done from the sidebar', async () => {
    const user = await openLive({
      privateData: {
        actionItems: [createActionItem({ memberId: ALEX.id, title: 'Share the design doc' })],
      },
    });

    await user.click(screen.getByRole('checkbox', { name: 'Share the design doc' }));

    expect(screen.getByRole('checkbox', { name: 'Share the design doc' })).toBeChecked();
    await waitFor(() =>
      expect(screen.getByText('Share the design doc (done)')).toBeInTheDocument(),
    );
  });

  it('starts from the saved draft', async () => {
    await openLive({ privateData: { noteDrafts: { [ALEX.id]: 'Carry on from here' } } });

    expect(screen.getByRole('textbox', { name: '1:1 notes' })).toHaveValue('Carry on from here');
  });

  it('adds an action item to the list and the notes from quick capture', async () => {
    const user = await openLive();

    await user.click(screen.getByRole('button', { name: 'Add action item' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Action item title' }),
      'Send the doc{Enter}',
    );

    expect(await screen.findByText('Action item added')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '1:1 notes' })).toHaveValue(
      '- **Action item:** Send the doc',
    );
    expect(screen.getByRole('textbox', { name: '1:1 notes' })).toHaveFocus();
    expect(screen.getByText('Send the doc (open)')).toBeInTheDocument();
  });

  it('adds a decision to the notes only', async () => {
    const user = await openLive();

    await user.click(screen.getByRole('button', { name: 'Add decision' }));
    await user.type(screen.getByRole('textbox', { name: 'Decision title' }), 'Ship Friday{Enter}');

    expect(screen.getByRole('textbox', { name: '1:1 notes' })).toHaveValue(
      '- **Decision:** Ship Friday',
    );
    expect(screen.queryByText(/Ship Friday \(/)).not.toBeInTheDocument();
  });

  it('refuses a capture that no longer fits in the note and creates no action item', async () => {
    const user = await openLive({
      privateData: { noteDrafts: { [ALEX.id]: 'x'.repeat(NOTE_MAX_LENGTH) } },
    });

    await user.click(screen.getByRole('button', { name: 'Add action item' }));
    await user.type(screen.getByRole('textbox', { name: 'Action item title' }), 'Too much{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Your notes are full');
    expect(screen.queryByText('Too much (open)')).not.toBeInTheDocument();
  });

  it('opens the action item form with Ctrl+Shift+A and the decision form with Ctrl+Shift+D', async () => {
    await openLive();

    fireEvent.keyDown(window, { key: 'A', ctrlKey: true, shiftKey: true });
    expect(screen.getByRole('textbox', { name: 'Action item title' })).toHaveFocus();

    fireEvent.keyDown(window, { key: 'D', ctrlKey: true, shiftKey: true });
    expect(screen.getByRole('textbox', { name: 'Decision title' })).toHaveFocus();
  });

  it('turns the shortcuts off from the sidebar and remembers it', async () => {
    const user = await openLive();

    await user.click(screen.getByRole('checkbox', { name: 'Keyboard shortcuts' }));
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true, shiftKey: true });

    expect(screen.queryByRole('textbox', { name: 'Action item title' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Keyboard shortcuts' })).not.toBeChecked();
  });

  it('shows the one-time notice and does not bring it back after it is dismissed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Host />, { initialData: { members: [ALEX] } });
    await user.click(screen.getByRole('button', { name: 'Start 1:1' }));

    expect(screen.getByText(/Live mode captures notes as you type/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Live mode captures notes as you type/)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '1:1 notes' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'End 1:1 meeting and save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Start 1:1' }));
    expect(screen.queryByText(/Live mode captures notes as you type/)).not.toBeInTheDocument();
  });

  it('ends the session: saves a note, closes, and returns focus to the button that opened it', async () => {
    const onEnd = vi.fn();
    const user = await openLive({ onEnd });

    await user.type(screen.getByRole('textbox', { name: '1:1 notes' }), 'Talked about growth');
    await user.click(screen.getByRole('button', { name: 'End 1:1 meeting and save' }));

    await waitFor(() => expect(onEnd).toHaveBeenCalledOnce());
    const [session, note] = onEnd.mock.calls[0] as [LiveSession, Note];
    expect(note.content).toBe('Talked about growth');
    expect(note.memberId).toBe(ALEX.id);
    expect(session.memberId).toBe(ALEX.id);
    expect(Date.parse(session.endedAt ?? '')).toBeGreaterThanOrEqual(Date.parse(session.startedAt));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start 1:1' })).toHaveFocus();
  });

  it('saves an empty session as a placeholder note', async () => {
    const onEnd = vi.fn();
    const user = await openLive({ onEnd });

    await user.click(screen.getByRole('button', { name: 'End 1:1 meeting and save' }));

    await waitFor(() => expect(onEnd).toHaveBeenCalledOnce());
    expect((onEnd.mock.calls[0] as [LiveSession, Note])[1].content).toBe('(No notes)');
  });

  it('has no accessibility violations', async () => {
    await openLive({
      privateData: {
        notes: [createNote({ memberId: ALEX.id })],
        actionItems: [createActionItem({ memberId: ALEX.id })],
      },
    });

    expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations();
  });
});

describe('LiveMode timing', () => {
  beforeEach(() => {
    reduceMotion();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const openWithFakeTimers = (onEnd = vi.fn()) => {
    renderWithProviders(<Host onEnd={onEnd} />, {
      initialData: { members: [ALEX], ...SETTINGS_SEEN },
    });
    act(() => screen.getByRole('button', { name: 'Start 1:1' }).click());
  };

  it('counts the timer up as time passes', () => {
    openWithFakeTimers();

    act(() => void vi.advanceTimersByTime(65_000));

    expect(screen.getByRole('timer')).toHaveTextContent('1:05');
  });

  it('saves after five quiet seconds and announces Saving then Saved in a polite region', async () => {
    openWithFakeTimers();
    const status = within(screen.getByRole('dialog')).getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');

    fireEvent.change(screen.getByRole('textbox', { name: '1:1 notes' }), {
      target: { value: 'Typed' },
    });
    act(() => void vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1));
    expect(status).toHaveTextContent('');

    await act(async () => void vi.advanceTimersByTime(1));
    expect(status).toHaveTextContent('Saved');
  });

  it('warns before the page unloads while there are unsaved changes only', () => {
    openWithFakeTimers();
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);

    fireEvent.change(screen.getByRole('textbox', { name: '1:1 notes' }), {
      target: { value: 'Typed' },
    });

    expect(unload()).toBe(true);
  });
});
