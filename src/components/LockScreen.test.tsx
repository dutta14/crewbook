import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StorageManager } from '../data/StorageManager';
import { STORAGE_DATA_KEY, STORAGE_SALT_KEY } from '../utils/encryptedStorage';
import { EncryptedStorageProvider } from './EncryptedStorageProvider';
import { LockGate } from './LockGate';
import { ToastProvider } from './Toast';

vi.mock('../utils/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/crypto')>();
  const { fastDeriveKey } = await import('../test-utils/fastCrypto');
  return { ...actual, deriveKey: fastDeriveKey };
});

const PASSPHRASE = 'correct horse battery staple';

function renderGate() {
  return render(
    <ToastProvider>
      <EncryptedStorageProvider>
        <LockGate>
          <h1>Dashboard</h1>
        </LockGate>
      </EncryptedStorageProvider>
    </ToastProvider>,
  );
}

async function seedExistingData() {
  const manager = new StorageManager();
  await manager.setup(PASSPHRASE);
  await manager.lock();
}

const passphraseInput = () => screen.getByLabelText('Passphrase', { exact: true });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LockScreen setup view', () => {
  it('renders the setup view on first launch', () => {
    renderGate();

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Crewbook' })).toBeVisible();
    expect(screen.getByText('Set a passphrase to encrypt your data')).toBeVisible();
    expect(screen.getByLabelText('Confirm passphrase')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Get Started' })).toBeVisible();
  });

  it('renders the card title as an h1 inside the main landmark', () => {
    renderGate();

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1 }));
  });

  it('focuses the first passphrase input on mount', () => {
    renderGate();

    expect(passphraseInput()).toHaveFocus();
  });

  it('masks both inputs and disables browser autofill', () => {
    renderGate();

    for (const input of [passphraseInput(), screen.getByLabelText('Confirm passphrase')]) {
      expect(input).toHaveAttribute('type', 'password');
      expect(input).toHaveAttribute('autocomplete', 'off');
    }
  });

  it('rejects an empty passphrase', async () => {
    const user = userEvent.setup();
    renderGate();

    await user.click(screen.getByRole('button', { name: 'Get Started' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a passphrase to continue.');
    expect(screen.getByRole('heading', { name: 'Welcome to Crewbook' })).toBeVisible();
    expect(window.localStorage.getItem(STORAGE_DATA_KEY)).toBeNull();
  });

  it('rejects a confirmation that does not match and focuses the confirmation input', async () => {
    const user = userEvent.setup();
    renderGate();
    await user.type(passphraseInput(), 'abc123');
    await user.type(screen.getByLabelText('Confirm passphrase'), 'xyz789');

    await user.click(screen.getByRole('button', { name: 'Get Started' }));

    expect(screen.getByRole('alert')).toHaveTextContent("Passphrases don't match.");
    expect(screen.getByLabelText('Confirm passphrase')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Confirm passphrase')).toHaveFocus();
    expect(window.localStorage.getItem(STORAGE_DATA_KEY)).toBeNull();
  });

  it('treats passphrases that differ only by whitespace as a mismatch', async () => {
    const user = userEvent.setup();
    renderGate();
    await user.type(passphraseInput(), 'abc123');
    await user.type(screen.getByLabelText('Confirm passphrase'), 'abc123 ');

    await user.click(screen.getByRole('button', { name: 'Get Started' }));

    expect(screen.getByRole('alert')).toHaveTextContent("Passphrases don't match.");
  });

  it('stores encrypted data and shows the app once setup succeeds', async () => {
    const user = userEvent.setup();
    renderGate();
    await user.type(passphraseInput(), PASSPHRASE);
    await user.type(screen.getByLabelText('Confirm passphrase'), PASSPHRASE);

    await user.click(screen.getByRole('button', { name: 'Get Started' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    expect(window.localStorage.getItem(STORAGE_SALT_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(PASSPHRASE)).toBeNull();
    expect(JSON.stringify(window.localStorage)).not.toContain(PASSPHRASE);
  });

  it('submits the form when Enter is pressed in the confirmation field', async () => {
    const user = userEvent.setup();
    renderGate();
    await user.type(passphraseInput(), PASSPHRASE);
    await user.type(screen.getByLabelText('Confirm passphrase'), `${PASSPHRASE}{Enter}`);

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderGate();

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LockScreen unlock view', () => {
  it('renders the unlock view when encrypted data exists', async () => {
    await seedExistingData();

    renderGate();

    expect(screen.getByRole('heading', { level: 1, name: 'Crewbook' })).toBeVisible();
    expect(screen.getByText('Enter your passphrase to unlock')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeVisible();
    expect(screen.queryByLabelText('Confirm passphrase')).not.toBeInTheDocument();
  });

  it('hides the decorative lock icon from assistive technology', async () => {
    await seedExistingData();

    const { container } = renderGate();

    const icon = container.querySelector('.lock-card > svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders nothing from the app until the data is unlocked', async () => {
    await seedExistingData();

    renderGate();

    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('shows the app after the correct passphrase', async () => {
    await seedExistingData();
    const user = userEvent.setup();
    renderGate();

    await user.type(passphraseInput(), PASSPHRASE);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Unlock' })).not.toBeInTheDocument();
  });

  it('submits the form when Enter is pressed', async () => {
    await seedExistingData();
    const user = userEvent.setup();
    renderGate();

    await user.type(passphraseInput(), `${PASSPHRASE}{Enter}`);

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  it('shows an alert with the generic message for a wrong passphrase', async () => {
    await seedExistingData();
    const user = userEvent.setup();
    renderGate();

    await user.type(passphraseInput(), 'nope');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Wrong passphrase. Try again.');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(passphraseInput()).toHaveAttribute('aria-invalid', 'true');
    expect(passphraseInput()).toHaveAccessibleDescription('Wrong passphrase. Try again.');
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('shows the same generic message when the stored data is corrupted', async () => {
    await seedExistingData();
    window.localStorage.setItem(STORAGE_DATA_KEY, '{"v":2}');
    const user = userEvent.setup();
    renderGate();

    await user.type(passphraseInput(), PASSPHRASE);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong passphrase. Try again.');
  });

  it('clears the wrong passphrase and returns focus to the input', async () => {
    await seedExistingData();
    const user = userEvent.setup();
    renderGate();
    await user.type(passphraseInput(), 'nope');

    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => expect(passphraseInput()).toHaveFocus());
    expect(passphraseInput()).toHaveValue('');
  });

  it('clears the error once the user starts typing again', async () => {
    await seedExistingData();
    const user = userEvent.setup();
    renderGate();
    await user.type(passphraseInput(), 'nope');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await screen.findByRole('alert');

    await user.type(passphraseInput(), 'x');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks for a passphrase instead of attempting an empty unlock', async () => {
    await seedExistingData();
    const unlock = vi.spyOn(StorageManager.prototype, 'unlock');
    const user = userEvent.setup();
    renderGate();

    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter your passphrase.');
    expect(unlock).not.toHaveBeenCalled();
  });

  it('disables the input and marks the button busy while unlocking', async () => {
    await seedExistingData();
    let finish: () => void = () => undefined;
    vi.spyOn(StorageManager.prototype, 'unlock').mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup();
    renderGate();
    await user.type(passphraseInput(), PASSPHRASE);

    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    const button = screen.getByRole('button', { name: 'Unlocking…' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(passphraseInput()).toBeDisabled();
    finish();
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  it('ignores a second submit while an unlock is in flight', async () => {
    await seedExistingData();
    const unlock = vi
      .spyOn(StorageManager.prototype, 'unlock')
      .mockReturnValue(new Promise<void>(() => undefined));
    const user = userEvent.setup();
    renderGate();
    await user.type(passphraseInput(), PASSPHRASE);

    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await user.click(screen.getByRole('button', { name: 'Unlocking…' }));

    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it('shows a generic retry message when unlocking fails unexpectedly', async () => {
    await seedExistingData();
    vi.spyOn(StorageManager.prototype, 'unlock').mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderGate();

    await user.type(passphraseInput(), PASSPHRASE);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
  });

  it('has no accessibility violations, including in the error state', async () => {
    await seedExistingData();
    const user = userEvent.setup();
    const { container } = renderGate();
    expect(await axe(container)).toHaveNoViolations();

    await user.type(passphraseInput(), 'nope');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await screen.findByRole('alert');

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LockScreen unsupported and corrupted states', () => {
  it('explains that a secure context is needed when Web Crypto is unavailable', () => {
    vi.stubGlobal('crypto', {});

    renderGate();

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Crewbook' })).toBeVisible();
    expect(screen.getByText(/needs a secure connection/)).toBeVisible();
    expect(screen.queryByLabelText('Passphrase')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Get Started|Unlock/ })).not.toBeInTheDocument();
  });

  it('offers to erase data when the salt is missing but data exists', () => {
    window.localStorage.setItem(STORAGE_DATA_KEY, '{}');

    renderGate();

    expect(screen.getByRole('button', { name: 'Erase and start over' })).toBeVisible();
    expect(screen.queryByLabelText('Passphrase')).not.toBeInTheDocument();
  });

  it('keeps the data when the erase confirmation is cancelled', async () => {
    window.localStorage.setItem(STORAGE_DATA_KEY, '{}');
    const user = userEvent.setup();
    renderGate();

    await user.click(screen.getByRole('button', { name: 'Erase and start over' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(window.localStorage.getItem(STORAGE_DATA_KEY)).toBe('{}');
    expect(screen.getByRole('button', { name: 'Erase and start over' })).toBeVisible();
  });

  it('erases the data and returns to setup once the erase is confirmed', async () => {
    window.localStorage.setItem(STORAGE_DATA_KEY, '{}');
    const user = userEvent.setup();
    renderGate();

    await user.click(screen.getByRole('button', { name: 'Erase and start over' }));
    await user.click(screen.getByRole('button', { name: 'Erase everything' }));

    expect(window.localStorage.getItem(STORAGE_DATA_KEY)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Welcome to Crewbook' })).toBeVisible();
  });
});
