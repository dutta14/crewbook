import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { StorageWriteError } from '../utils/encryptedStorage';
import {
  EncryptedStorageContext,
  type EncryptedStorageContextValue,
} from './EncryptedStorageProvider';
import { MoodPrompt } from './MoodPrompt';
import { ToastProvider } from './Toast';
import { Settings } from '../pages/Settings';

function failingStorage(settings: Record<string, string>): EncryptedStorageContextValue {
  const data = new Map<string, unknown>([['settings', settings]]);
  const priv = new Map<string, unknown>();
  return {
    isUnlocked: true,
    isFirstLaunch: false,
    isCorrupted: false,
    isCryptoSupported: true,
    isPrivateUnlocked: true,
    unlock: async () => true,
    setup: async () => undefined,
    lock: () => undefined,
    reset: () => undefined,
    get: <T,>(key: string) => (data.get(key) as T) ?? null,
    set: <T,>(key: string, value: T) => void data.set(key, value),
    loadPrivate: async () => undefined,
    getPrivate: <T,>(key: string) => (priv.get(key) as T) ?? null,
    setPrivate: <T,>(key: string, value: T) => void priv.set(key, value),
    getShareSigningKey: () => null,
    flush: async () => new StorageWriteError(false, true),
    verifyPassphrase: async () => true,
    exportSnapshot: async () => ({ main: {}, private: {} }),
    replaceAll: async () => undefined,
  };
}

const renderFailing = (ui: React.ReactNode, settings: Record<string, string>) =>
  render(
    <ToastProvider>
      <EncryptedStorageContext.Provider value={failingStorage(settings)}>
        {ui}
      </EncryptedStorageContext.Provider>
    </ToastProvider>,
  );

describe('mood saving failures', () => {
  it('reverts the rating and says so when the write fails', async () => {
    const user = userEvent.setup();
    renderFailing(<MoodPrompt memberId="alex" noteId="n1" />, { moodTrackingEnabled: 'true' });

    await user.click(screen.getByRole('radio', { name: 'Good energy' }));

    expect(await screen.findByText("Couldn't save that rating. Try again.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Good energy' })).toHaveAttribute(
        'aria-checked',
        'false',
      ),
    );
  });

  it('keeps the switch off and says so when the setting cannot be saved', async () => {
    const user = userEvent.setup();
    renderFailing(<Settings />, {});

    await user.click(screen.getByRole('switch', { name: 'Track energy/mood after 1:1s' }));

    expect(await screen.findByText("Couldn't save that setting. Try again.")).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Track energy/mood after 1:1s' })).not.toBeChecked();
  });
});
