import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { ChangePassphrase } from './ChangePassphrase';

const OLD = 'test passphrase';
const NEW = 'a much longer new passphrase';

// Labels carry a required marker, so match on the start of the text.
const current = () => screen.getByLabelText(/^Current passphrase/);
const next = () => screen.getByLabelText(/^New passphrase/);
const confirm = () => screen.getByLabelText(/^Confirm new passphrase/);

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  values: { current?: string; next?: string; confirm?: string } = {},
) {
  const { current: a = OLD, next: b = NEW, confirm: c = NEW } = values;
  if (a) await user.type(current(), a);
  if (b) await user.type(next(), b);
  if (c) await user.type(confirm(), c);
}

const update = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Update' }));

describe('ChangePassphrase', () => {
  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <main>
        <ChangePassphrase />
      </main>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the strength of the new passphrase as you type', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePassphrase />);

    await user.type(next(), 'short pw');
    expect(screen.getByText(/Strength:/)).toHaveTextContent('Weak');

    await user.clear(next());
    await user.type(next(), NEW);
    expect(screen.getByText(/Strength:/)).toHaveTextContent('Strong');
  });

  it('asks for the current passphrase and focuses it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePassphrase />);

    await fill(user, { current: '' });
    await update(user);

    expect(await screen.findByText('Enter your current passphrase')).toBeInTheDocument();
    await waitFor(() => expect(current()).toHaveFocus());
  });

  it('rejects a new passphrase that is too short', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePassphrase />);

    await fill(user, { next: 'short', confirm: 'short' });
    await update(user);

    expect(await screen.findByText(/at least 8 characters/)).toBeInTheDocument();
    await waitFor(() => expect(next()).toHaveFocus());
  });

  it('rejects a new passphrase that matches the current one', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePassphrase />);

    await fill(user, { next: OLD, confirm: OLD });
    await update(user);

    expect(
      await screen.findByText('Choose a passphrase different from your current one'),
    ).toBeInTheDocument();
  });

  it('rejects a confirmation that does not match', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePassphrase />);

    await fill(user, { confirm: 'something else entirely' });
    await update(user);

    expect(await screen.findByText('Passphrases do not match')).toBeInTheDocument();
    await waitFor(() => expect(confirm()).toHaveFocus());
  });

  it('reports a wrong current passphrase on that field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePassphrase />);

    await fill(user, { current: 'not my passphrase' });
    await update(user);

    expect(await screen.findByText('Current passphrase is incorrect')).toBeInTheDocument();
    await waitFor(() => expect(current()).toHaveFocus());
    expect(next()).toHaveValue(NEW);
  });

  it('clears the fields and confirms once the passphrase is updated', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePassphrase />);

    await fill(user);
    await update(user);

    expect(await screen.findByText('Passphrase updated')).toBeInTheDocument();
    expect(current()).toHaveValue('');
    expect(next()).toHaveValue('');
    expect(confirm()).toHaveValue('');
  });

  it('treats the new passphrase as the current one afterwards', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePassphrase />);
    await fill(user);
    await update(user);
    await screen.findByText('Passphrase updated');

    await fill(user, { current: OLD });
    await update(user);

    expect(await screen.findByText('Current passphrase is incorrect')).toBeInTheDocument();
  });

  it('tells you your data is safe when re-encryption fails', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePassphrase />, { failPassphraseChange: true });

    await fill(user);
    await update(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Passphrase change failed. Your data is safe with your current passphrase.',
    );
    expect(next()).toHaveValue(NEW);
  });

  it('clears everything typed when you cancel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePassphrase />);
    await fill(user);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(current()).toHaveValue('');
    expect(next()).toHaveValue('');
    expect(screen.queryByText(/Strength:/)).not.toBeInTheDocument();
  });

  it('can show and hide what you type', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePassphrase />);
    expect(next()).toHaveAttribute('type', 'password');

    await user.click(screen.getAllByRole('button', { name: 'Show password' })[1]);

    expect(next()).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });
});
