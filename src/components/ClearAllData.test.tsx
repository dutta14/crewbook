import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { ClearAllData, CLEARED_REMINDER } from './ClearAllData';

function Stored() {
  const storage = useEncryptedStorage();
  return (
    <>
      <output aria-label="Members">{JSON.stringify(storage.get('members'))}</output>
      <output aria-label="Share tokens">{JSON.stringify(storage.get('shareTokens'))}</output>
      <output aria-label="Private">{JSON.stringify(storage.getPrivate('flightRisk'))}</output>
    </>
  );
}

function renderClear(props: Partial<React.ComponentProps<typeof ClearAllData>> = {}) {
  const onCleared = vi.fn();
  const view = renderWithProviders(
    <main>
      <ClearAllData showReminder={false} onCleared={onCleared} countdownSeconds={1} {...props} />
      <Stored />
    </main>,
    {
      initialData: { members: [{ id: 'm1' }], shareTokens: [{ id: 't1' }] } as never,
      initialPrivateData: { flightRisk: { m1: 'high' } },
    },
  );
  return { ...view, onCleared };
}

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

const openConfirmStep = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Clear All Data' }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
};

describe('ClearAllData', () => {
  it('warns first, with Cancel focused rather than the destructive action', async () => {
    const user = userEvent.setup();
    renderClear();

    await user.click(screen.getByRole('button', { name: 'Clear All Data' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Clear all data?' });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(dialog).toHaveAccessibleDescription(/cannot be undone/);
  });

  it('has no accessibility violations in either step', async () => {
    const user = userEvent.setup();
    const { baseElement } = renderClear();
    await user.click(screen.getByRole('button', { name: 'Clear All Data' }));
    expect(await axe(baseElement)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it('keeps all data and returns focus when cancelled at the first step', async () => {
    const user = userEvent.setup();
    const { onCleared } = renderClear();
    const trigger = screen.getByRole('button', { name: 'Clear All Data' });
    await user.click(trigger);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('status', { name: 'Members' })).toHaveTextContent('m1');
    expect(onCleared).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(trigger).toHaveFocus());
  });

  it('keeps all data when Escape closes the second step', async () => {
    const user = userEvent.setup();
    renderClear();
    await openConfirmStep(user);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Members' })).toHaveTextContent('m1');
  });

  it('keeps the final button locked until DELETE is typed exactly', async () => {
    const user = userEvent.setup();
    const { onCleared } = renderClear();
    await openConfirmStep(user);
    const final = screen.getByRole('button', { name: 'Delete Everything' });
    expect(final).toHaveAttribute('aria-disabled', 'true');

    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'delete');
    await user.click(final);

    expect(final).toHaveAttribute('aria-disabled', 'true');
    expect(onCleared).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: 'Members' })).toHaveTextContent('m1');
  });

  it('makes the user wait out the countdown after typing DELETE', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { onCleared } = renderClear({ countdownSeconds: 3 });
    await openConfirmStep(user);
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    const final = screen.getByRole('button', { name: 'Delete Everything' });

    expect(screen.getByText(/unlocks in 3 seconds/)).toBeInTheDocument();
    await user.click(final);
    expect(onCleared).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText(/unlocks in 2 seconds/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(final).toHaveAttribute('aria-disabled', 'false');
  });

  it('starts the countdown over when the typed word stops matching', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderClear({ countdownSeconds: 3 });
    await openConfirmStep(user);
    const input = screen.getByLabelText('Type DELETE to confirm');
    await user.type(input, 'DELETE');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    await user.type(input, 'X');
    await user.type(input, '{Backspace}');

    expect(screen.getByText(/unlocks in 3 seconds/)).toBeInTheDocument();
  });

  it('wipes every key in both envelopes, then reports it', async () => {
    const user = userEvent.setup();
    localStorage.setItem('dashboard-collapse-state', '{"a":true}');
    localStorage.setItem('theme', 'dark');
    const { onCleared } = renderClear();
    await openConfirmStep(user);
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await vi.waitFor(
      () =>
        expect(screen.getByRole('button', { name: 'Delete Everything' })).toHaveAttribute(
          'aria-disabled',
          'false',
        ),
      { timeout: 3000 },
    );

    await user.click(screen.getByRole('button', { name: 'Delete Everything' }));

    await vi.waitFor(() => expect(onCleared).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status', { name: 'Members' })).toHaveTextContent('null');
    expect(screen.getByRole('status', { name: 'Share tokens' })).toHaveTextContent('null');
    expect(screen.getByRole('status', { name: 'Private' })).toHaveTextContent('null');
    expect(localStorage.getItem('dashboard-collapse-state')).toBeNull();
    expect(localStorage.getItem('theme')).toBeNull();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows the reminder about exported files when asked to', () => {
    renderClear({ showReminder: true });

    expect(screen.getByText(CLEARED_REMINDER)).toBeInTheDocument();
  });
});
