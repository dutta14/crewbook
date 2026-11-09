import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { Settings } from './Settings';

function StoredSettings() {
  const { get } = useEncryptedStorage();
  return <output aria-label="Stored settings">{JSON.stringify(get('settings'))}</output>;
}

const renderSettings = (settings?: Record<string, string>) =>
  renderWithProviders(
    <>
      <Settings />
      <StoredSettings />
    </>,
    { initialData: settings ? { settings } : {} },
  );

describe('Settings', () => {
  it('offers the mood switch under Privacy, off by default', () => {
    renderSettings();

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Privacy' })).toBeInTheDocument();
    const toggle = screen.getByRole('switch', { name: 'Track energy/mood after 1:1s' });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleDescription('Only visible to you. Never shared.');
  });

  it('turns tracking on and off and stores the choice', async () => {
    const user = userEvent.setup();
    renderSettings();
    const toggle = screen.getByRole('switch', { name: 'Track energy/mood after 1:1s' });

    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(screen.getByRole('status', { name: 'Stored settings' })).toHaveTextContent(
      '"moodTrackingEnabled":"true"',
    );

    await user.keyboard(' ');
    expect(toggle).not.toBeChecked();
  });

  it('reflects a saved opt-in', () => {
    renderSettings({ moodTrackingEnabled: 'true' });

    expect(screen.getByRole('switch', { name: 'Track energy/mood after 1:1s' })).toBeChecked();
  });

  it('offers a Hide risk indicators switch, off by default, that stores the choice', async () => {
    const user = userEvent.setup();
    renderSettings();
    const toggle = screen.getByRole('switch', { name: 'Hide risk indicators' });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleDescription(/Hides the dots on the roster/);

    await user.click(toggle);

    expect(toggle).toBeChecked();
    expect(screen.getByRole('status', { name: 'Stored settings' })).toHaveTextContent(
      '"hideRiskIndicators":"true"',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = renderSettings();

    expect(await axe(container)).toHaveNoViolations();
  });

  it('offers a default visibility for new notes that starts as private', () => {
    renderSettings();

    const group = screen.getByRole('group', { name: 'Default visibility for new notes' });
    expect(within(group).getByRole('radio', { name: /Private/ })).toBeChecked();
    expect(within(group).getByRole('radio', { name: /Shared/ })).not.toBeChecked();
  });

  it('stores the chosen default visibility and can return to private', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('radio', { name: /Shared/ }));
    expect(screen.getByRole('radio', { name: /Shared/ })).toBeChecked();
    expect(screen.getByRole('status', { name: 'Stored settings' })).toHaveTextContent(
      '"defaultNoteVisibility":"shared"',
    );

    await user.click(screen.getByRole('radio', { name: /Private/ }));
    expect(screen.getByRole('status', { name: 'Stored settings' })).toHaveTextContent(
      '"defaultNoteVisibility":"private"',
    );
  });

  it('shows private when the stored default is not exactly shared', () => {
    renderSettings({ defaultNoteVisibility: 'Shared' });

    expect(screen.getByRole('radio', { name: /Private/ })).toBeChecked();
  });
});
