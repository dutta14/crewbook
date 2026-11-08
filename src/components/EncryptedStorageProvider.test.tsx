import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { StorageManager } from '../data/StorageManager';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { STORAGE_DATA_KEY, StorageWriteError } from '../utils/encryptedStorage';
import { EncryptedStorageProvider } from './EncryptedStorageProvider';
import { LockGate } from './LockGate';
import { ToastProvider } from './Toast';

vi.mock('../utils/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/crypto')>();
  const { fastDeriveKey } = await import('../test-utils/fastCrypto');
  return { ...actual, deriveKey: fastDeriveKey };
});

const PASSPHRASE = 'correct horse battery staple';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>
    <EncryptedStorageProvider>{children}</EncryptedStorageProvider>
  </ToastProvider>
);

async function setUpHook() {
  const view = renderHook(() => useEncryptedStorage(), { wrapper });
  await act(() => view.result.current.setup(PASSPHRASE));
  // Pending debounced writes would otherwise land in the next test's localStorage.
  onTestFinished(() => view.result.current.flush());
  return view;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useEncryptedStorage', () => {
  it('throws a helpful error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useEncryptedStorage())).toThrow(
      'useEncryptedStorage must be used within an EncryptedStorageProvider',
    );
  });

  it('starts locked and flags a first launch', () => {
    const { result } = renderHook(() => useEncryptedStorage(), { wrapper });

    expect(result.current).toMatchObject({
      isUnlocked: false,
      isFirstLaunch: true,
      isCorrupted: false,
      isCryptoSupported: true,
    });
    expect(result.current.get('members')).toBeNull();
  });

  it('reads back values written with set and re-renders consumers', async () => {
    const { result } = await setUpHook();
    expect(result.current.get('members')).toBeNull();

    act(() => result.current.set('members', ['m1']));

    expect(result.current.get('members')).toEqual(['m1']);
  });

  it('persists written values only as ciphertext after flush', async () => {
    const { result } = await setUpHook();

    act(() => result.current.set('notes', 'secret-note-text'));
    await act(() => result.current.flush());

    const stored = window.localStorage.getItem(STORAGE_DATA_KEY) ?? '';
    expect(stored).not.toBe('');
    expect(stored).not.toContain('secret-note-text');
  });

  it('keeps private values separate and unavailable until loadPrivate runs', async () => {
    const { result } = await setUpHook();
    expect(result.current.isPrivateUnlocked).toBe(false);

    await act(() => result.current.loadPrivate());
    act(() => result.current.setPrivate('flightRisk', { m1: 'low' }));

    expect(result.current.isPrivateUnlocked).toBe(true);
    expect(result.current.getPrivate('flightRisk')).toEqual({ m1: 'low' });
    expect(result.current.get('flightRisk')).toBeNull();
  });

  it('returns false for a wrong passphrase and true for the right one', async () => {
    const first = await setUpHook();
    await act(() => first.result.current.flush());
    act(() => first.result.current.lock());
    first.unmount();
    const { result } = renderHook(() => useEncryptedStorage(), { wrapper });

    let wrong = true;
    let right = false;
    await act(async () => {
      wrong = await result.current.unlock('nope');
      right = await result.current.unlock(PASSPHRASE);
    });

    expect(wrong).toBe(false);
    expect(right).toBe(true);
    expect(result.current.isUnlocked).toBe(true);
  });

  it('forgets data in memory when locked', async () => {
    const { result } = await setUpHook();
    act(() => result.current.set('members', ['m1']));

    act(() => result.current.lock());

    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.get('members')).toBeNull();
  });

  it('returns to the lock screen when locked', async () => {
    const user = userEvent.setup();
    function LockButton() {
      const { lock } = useEncryptedStorage();
      return <button onClick={lock}>Lock now</button>;
    }
    render(
      <ToastProvider>
        <EncryptedStorageProvider>
          <LockGate>
            <LockButton />
          </LockGate>
        </EncryptedStorageProvider>
      </ToastProvider>,
    );
    await user.type(screen.getByLabelText('Passphrase', { exact: true }), 'pass');
    await user.type(screen.getByLabelText('Confirm passphrase'), 'pass');
    await user.click(screen.getByRole('button', { name: 'Get Started' }));

    await user.click(await screen.findByRole('button', { name: 'Lock now' }));

    expect(screen.getByRole('heading', { name: 'Crewbook' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Lock now' })).not.toBeInTheDocument();
  });
});

describe('EncryptedStorageProvider notifications', () => {
  it('toasts when browser storage is full', async () => {
    const listeners: Array<(error: StorageWriteError) => void> = [];
    vi.spyOn(StorageManager.prototype, 'onWriteError').mockImplementation((listener) => {
      listeners.push(listener);
      return () => undefined;
    });
    renderHook(() => useEncryptedStorage(), { wrapper });

    act(() => listeners.forEach((listener) => listener(new StorageWriteError(true, false))));

    expect(await screen.findByText(/Browser storage is full/)).toBeInTheDocument();
  });

  it('toasts when private notes fail to save', async () => {
    const listeners: Array<(error: StorageWriteError) => void> = [];
    vi.spyOn(StorageManager.prototype, 'onWriteError').mockImplementation((listener) => {
      listeners.push(listener);
      return () => undefined;
    });
    renderHook(() => useEncryptedStorage(), { wrapper });

    act(() => listeners.forEach((listener) => listener(new StorageWriteError(false, true))));

    expect(await screen.findByText("Couldn't save your private notes. Try again.")).toBeVisible();
  });

  it('tells the user when unreadable data was replaced with an empty set', async () => {
    vi.spyOn(StorageManager.prototype, 'didRecoverFromCorruption', 'get').mockReturnValue(true);
    const { result } = renderHook(() => useEncryptedStorage(), { wrapper });

    await act(() => result.current.setup(PASSPHRASE));
    const first = result.current;
    await act(async () => {
      first.lock();
    });
    await act(async () => {
      await result.current.unlock(PASSPHRASE);
    });

    await waitFor(() =>
      expect(screen.getByText(/saved data couldn't be read/)).toBeInTheDocument(),
    );
  });

  it('flushes pending writes when the page is about to unload', async () => {
    const { result } = await setUpHook();
    const flush = vi.spyOn(StorageManager.prototype, 'flush');
    act(() => result.current.set('members', ['m1']));

    window.dispatchEvent(new Event('beforeunload'));

    expect(flush).toHaveBeenCalled();
  });
});
