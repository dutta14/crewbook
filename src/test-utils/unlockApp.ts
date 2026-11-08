import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** Completes first-launch setup through the real lock screen. */
export async function setUpPassphrase(user: UserEvent, passphrase = 'test passphrase') {
  await user.type(screen.getByLabelText('Passphrase', { exact: true }), passphrase);
  await user.type(screen.getByLabelText('Confirm passphrase'), passphrase);
  await user.click(screen.getByRole('button', { name: 'Get Started' }));
  await screen.findByRole('navigation', { name: 'Main navigation' }, { timeout: 5000 });
}
