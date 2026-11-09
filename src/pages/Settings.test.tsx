import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { CLEARED_REMINDER } from '../components/ClearAllData';
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

  it('has a Data Management section with the export, CSV and import controls', () => {
    renderSettings();

    const section = screen.getByRole('region', { name: 'Data Management' });
    expect(within(section).getByRole('button', { name: 'Export Data' })).toBeInTheDocument();
    expect(
      within(section).getByRole('button', { name: 'Download CSV (Unencrypted)' }),
    ).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Import Data' })).toBeInTheDocument();
    expect(within(section).getByLabelText('Select backup file to import')).toBeInTheDocument();
  });

  it('groups settings into General, Privacy and Data Management sections', () => {
    renderSettings();

    for (const name of ['General', 'Privacy', 'Data Management']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    expect(
      within(screen.getByRole('region', { name: 'Data Management' })).getByRole('button', {
        name: 'Clear All Data',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Data Management' })).getByRole('button', {
        name: 'Update',
      }),
    ).toBeInTheDocument();
  });

  it('turns dark mode on and off for this browser', async () => {
    const user = userEvent.setup();
    renderSettings();
    const toggle = screen.getByRole('switch', { name: 'Dark mode' });

    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(document.body).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    await user.click(toggle);
    expect(document.body).not.toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('defaults the general preferences and stores each change', async () => {
    const user = userEvent.setup();
    renderSettings();
    const cadence = screen.getByRole('combobox', { name: 'Default 1:1 cadence' });
    const dateFormat = screen.getByRole('combobox', { name: 'Date format' });
    const firstDay = screen.getByRole('combobox', { name: 'First day of week' });
    expect(cadence).toHaveValue('weekly');
    expect(dateFormat).toHaveValue('MM/DD/YYYY');
    expect(firstDay).toHaveValue('monday');

    await user.selectOptions(cadence, 'biweekly');
    await user.selectOptions(dateFormat, 'DD/MM/YYYY');
    await user.selectOptions(firstDay, 'sunday');

    const stored = screen.getByRole('status', { name: 'Stored settings' });
    expect(stored).toHaveTextContent('"defaultCadence":"biweekly"');
    expect(stored).toHaveTextContent('"dateFormat":"DD/MM/YYYY"');
    expect(stored).toHaveTextContent('"firstDayOfWeek":"sunday"');
  });

  it('keeps live mode shortcuts on by default and stores turning them off', async () => {
    const user = userEvent.setup();
    renderSettings();
    const toggle = screen.getByRole('switch', { name: 'Live mode keyboard shortcuts' });
    expect(toggle).toBeChecked();

    await user.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(screen.getByRole('status', { name: 'Stored settings' })).toHaveTextContent(
      '"liveModeShortcuts":"false"',
    );
  });

  it('confirms a saved change with a brief Saved message', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Date format' }), 'DD/MM/YYYY');

    expect(await screen.findByText('Saved')).toBeVisible();
  });

  it('offers a private data auto-lock that defaults to five minutes', async () => {
    const user = userEvent.setup();
    renderSettings();
    const select = screen.getByRole('combobox', { name: 'Private data auto-lock' });
    expect(select).toHaveValue('5');

    await user.selectOptions(select, '0');

    expect(screen.getByRole('status', { name: 'Stored settings' })).toHaveTextContent(
      '"privateAutoLockMinutes":"0"',
    );
  });

  describe('turning mood tracking off', () => {
    const entry = (id: string) => ({
      id,
      memberId: 'm1',
      noteId: 'n1',
      score: 3,
      recordedAt: '2026-01-01T00:00:00.000Z',
    });
    const renderWithMoods = (count: number) =>
      renderWithProviders(
        <>
          <Settings />
          <MoodCount />
        </>,
        {
          initialData: { settings: { moodTrackingEnabled: 'true' } },
          initialPrivateData: { moods: Array.from({ length: count }, (_, i) => entry(`e${i}`)) },
        },
      );

    function MoodCount() {
      const { getPrivate } = useEncryptedStorage();
      return (
        <output aria-label="Stored moods">{(getPrivate<unknown[]>('moods') ?? []).length}</output>
      );
    }

    it('offers to delete saved entries, keeping them by default', async () => {
      const user = userEvent.setup();
      renderWithMoods(2);

      await user.click(screen.getByRole('switch', { name: 'Track energy/mood after 1:1s' }));

      const dialog = await screen.findByRole('alertdialog', {
        name: 'Delete saved mood entries?',
      });
      expect(within(dialog).getByRole('button', { name: 'Keep entries' })).toHaveFocus();
      await user.click(within(dialog).getByRole('button', { name: 'Keep entries' }));
      expect(screen.getByRole('status', { name: 'Stored moods' })).toHaveTextContent('2');
    });

    it('deletes every entry when asked to', async () => {
      const user = userEvent.setup();
      renderWithMoods(2);
      await user.click(screen.getByRole('switch', { name: 'Track energy/mood after 1:1s' }));

      await user.click(await screen.findByRole('button', { name: 'Delete 2 entries' }));

      expect(await screen.findByText('Mood entries deleted')).toBeInTheDocument();
      expect(screen.getByRole('status', { name: 'Stored moods' })).toHaveTextContent('0');
    });

    it('does not ask when there is nothing to delete', async () => {
      const user = userEvent.setup();
      renderWithMoods(0);

      await user.click(screen.getByRole('switch', { name: 'Track energy/mood after 1:1s' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('reminds you about exported files after clearing all data, and empties the page data', async () => {
    const user = userEvent.setup();
    renderSettings({ dateFormat: 'DD/MM/YYYY' });
    await user.click(screen.getByRole('button', { name: 'Clear All Data' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText(/^Type DELETE/), 'DELETE');
    await waitFor(
      () =>
        expect(screen.getByRole('button', { name: 'Delete Everything' })).toHaveAttribute(
          'aria-disabled',
          'false',
        ),
      { timeout: 5000 },
    );

    await user.click(screen.getByRole('button', { name: 'Delete Everything' }));

    expect(await screen.findByText(CLEARED_REMINDER)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Date format' })).toHaveValue('MM/DD/YYYY');
  });
});
