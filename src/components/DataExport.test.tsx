import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { BackupTooLargeError } from '../utils/backupFile';
import { WrongPassphraseError } from '../utils/encryptedStorage';
import type { ExportPreview, ExportResult } from '../utils/exportBackup';
import { DataExport, type DataExportProps } from './DataExport';

const PREVIEW: ExportPreview = {
  privateAvailable: true,
  privateCounts: [
    { id: 'notes', count: 12, label: 'notes' },
    { id: 'moods', count: 1, label: 'mood entry' },
    { id: 'skills', count: 0, label: 'skills' },
  ],
};

const RESULT: ExportResult = {
  fileName: 'crewbook-backup-2025-06-01.json.enc',
  privateDataIncluded: true,
  exportedAt: '2025-06-01T10:00:00.000Z',
};

function setup(overrides: Partial<DataExportProps> = {}) {
  const props: DataExportProps = {
    lastBackupAt: null,
    getPreview: vi.fn(async () => PREVIEW),
    onExport: vi.fn(async () => RESULT),
    onExportCsv: vi.fn(() => 'crewbook-roster-2025-06-01.csv'),
    ...overrides,
  };
  const user = userEvent.setup();
  renderWithProviders(<DataExport {...props} />);
  return { props, user };
}

const exportButton = () => screen.getByRole('button', { name: 'Export Data' });

describe('DataExport', () => {
  it('offers the three data actions and does not read any data until one is chosen', () => {
    const { props } = setup();

    expect(exportButton()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download CSV (Unencrypted)' })).toBeEnabled();
    expect(props.getPreview).not.toHaveBeenCalled();
  });

  it('says there has been no backup yet', () => {
    setup();

    expect(screen.getByText('Last backup: Never')).toBeInTheDocument();
  });

  it('shows the date of the last backup', () => {
    setup({ lastBackupAt: '2025-03-04T12:00:00.000Z' });

    expect(screen.getByText(/^Last backup: Mar 4, 2025$/)).toBeInTheDocument();
  });

  it('shows "Unknown" when the saved date cannot be read', () => {
    setup({ lastBackupAt: 'garbage' });

    expect(screen.getByText('Last backup: Unknown')).toBeInTheDocument();
  });

  describe('the export dialog', () => {
    it('warns that private data is included and counts what will be in the file', async () => {
      const { user } = setup();

      await user.click(exportButton());

      const dialog = await screen.findByRole('dialog', { name: 'Export Data' });
      expect(dialog).toHaveTextContent('includes your private data');
      expect(await screen.findByText('12 notes')).toBeInTheDocument();
      expect(screen.getByText('1 mood entry')).toBeInTheDocument();
      expect(screen.queryByText(/skills/)).not.toBeInTheDocument();
      expect(dialog).toHaveTextContent(/cloud/);
      expect(dialog).toHaveTextContent(/your responsibility/);
    });

    it('puts focus in the passphrase field', async () => {
      const { user } = setup();

      await user.click(exportButton());

      expect(await screen.findByLabelText(/Passphrase/)).toHaveFocus();
    });

    it('says private data will be left out when it cannot be read', async () => {
      const { user } = setup({
        getPreview: vi.fn(async () => ({ privateAvailable: false, privateCounts: [] })),
      });

      await user.click(exportButton());

      expect(await screen.findByText(/will be left out of this backup/)).toBeInTheDocument();
    });

    it('says so when the data could not be read to prepare the warning', async () => {
      const { user } = setup({
        getPreview: vi.fn(async () => {
          throw new Error('boom');
        }),
      });

      await user.click(exportButton());

      expect(await screen.findByText(/Couldn't read your data/)).toBeInTheDocument();
    });

    it('asks for a passphrase instead of exporting without one', async () => {
      const { props, user } = setup();
      await user.click(exportButton());

      await user.click(await screen.findByRole('button', { name: 'Export backup' }));

      expect(screen.getByLabelText(/Passphrase/)).toHaveAccessibleDescription(
        'Enter your passphrase to create the backup.',
      );
      expect(props.onExport).not.toHaveBeenCalled();
    });

    it('exports with the typed passphrase, closes, and confirms with a toast', async () => {
      const { props, user } = setup();
      await user.click(exportButton());

      await user.type(await screen.findByLabelText(/Passphrase/), 'my secret');
      await user.click(screen.getByRole('button', { name: 'Export backup' }));

      expect(props.onExport).toHaveBeenCalledWith('my secret');
      expect(await screen.findByText(`Backup saved as ${RESULT.fileName}`)).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(exportButton()).toHaveFocus();
    });

    it('submits with the Enter key', async () => {
      const { props, user } = setup();
      await user.click(exportButton());

      await user.type(await screen.findByLabelText(/Passphrase/), 'my secret{Enter}');

      expect(props.onExport).toHaveBeenCalledWith('my secret');
    });

    it('mentions in the toast when private data was left out', async () => {
      const { user } = setup({
        onExport: vi.fn(async () => ({ ...RESULT, privateDataIncluded: false })),
      });
      await user.click(exportButton());

      await user.type(await screen.findByLabelText(/Passphrase/), 'x{Enter}');

      expect(await screen.findByText(/Private data could not be read/)).toBeInTheDocument();
    });

    it('shows an inline error and stays open for a wrong passphrase', async () => {
      const { user } = setup({
        onExport: vi.fn(async () => {
          throw new WrongPassphraseError();
        }),
      });
      await user.click(exportButton());

      await user.type(await screen.findByLabelText(/Passphrase/), 'nope{Enter}');

      const field = await screen.findByLabelText(/Passphrase/);
      await waitFor(() => expect(field).toHaveAccessibleDescription(/isn't the passphrase/));
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Export backup' })).toBeEnabled();
    });

    it('shows the size message when the backup is too large', async () => {
      const { user } = setup({
        onExport: vi.fn(async () => {
          throw new BackupTooLargeError();
        }),
      });
      await user.click(exportButton());

      await user.type(await screen.findByLabelText(/Passphrase/), 'x{Enter}');

      expect(await screen.findByText(/larger than 10 MB/)).toBeInTheDocument();
    });

    it('shows a general error and keeps the dialog for any other failure', async () => {
      const { user } = setup({
        onExport: vi.fn(async () => {
          throw new Error('disk on fire');
        }),
      });
      await user.click(exportButton());

      await user.type(await screen.findByLabelText(/Passphrase/), 'x{Enter}');

      expect(await screen.findByText(/Couldn't create the backup/)).toBeInTheDocument();
      expect(screen.queryByText(/disk on fire/)).not.toBeInTheDocument();
    });

    it('shows a busy state while exporting and ignores Escape and a second click', async () => {
      let finish: (value: ExportResult) => void = () => undefined;
      const onExport = vi.fn(
        () =>
          new Promise<ExportResult>((resolve) => {
            finish = resolve;
          }),
      );
      const { user } = setup({ onExport });
      await user.click(exportButton());
      await user.type(await screen.findByLabelText(/Passphrase/), 'x{Enter}');

      const busy = await screen.findByRole('button', { name: 'Exporting data, please wait' });
      expect(busy).toHaveAttribute('aria-busy', 'true');
      expect(busy).toBeDisabled();
      expect(busy).toHaveTextContent('Exporting...');
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      await user.keyboard('{Escape}');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(onExport).toHaveBeenCalledTimes(1);

      finish(RESULT);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('closes with Cancel and Escape without exporting', async () => {
      const { props, user } = setup();
      await user.click(exportButton());
      await user.click(await screen.findByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await user.click(exportButton());
      await screen.findByRole('dialog');
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(props.onExport).not.toHaveBeenCalled();
      expect(exportButton()).toHaveFocus();
    });

    it('does not keep a passphrase after the dialog is closed and reopened', async () => {
      const { user } = setup();
      await user.click(exportButton());
      await user.type(await screen.findByLabelText(/Passphrase/), 'leftover');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await user.click(exportButton());

      expect(await screen.findByLabelText(/Passphrase/)).toHaveValue('');
    });

    it('has no accessibility violations', async () => {
      const { user } = setup();
      await user.click(exportButton());
      const dialog = screen.getByRole('dialog');
      await screen.findByText('12 notes');

      expect(await axe(dialog)).toHaveNoViolations();
    });
  });

  describe('the CSV download', () => {
    const csvButton = () => screen.getByRole('button', { name: 'Download CSV (Unencrypted)' });

    it('asks first, and explains the file is not encrypted', async () => {
      const { props, user } = setup();

      await user.click(csvButton());

      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toHaveTextContent(/not encrypted/);
      expect(props.onExportCsv).not.toHaveBeenCalled();
    });

    it('downloads after confirming and reminds the person to delete the file', async () => {
      const { props, user } = setup();
      await user.click(csvButton());

      await user.click(await screen.findByRole('button', { name: 'Download CSV' }));

      expect(props.onExportCsv).toHaveBeenCalledTimes(1);
      expect(
        await screen.findByText(/Remember to delete the export file when you're done/),
      ).toBeInTheDocument();
    });

    it('downloads nothing when cancelled', async () => {
      const { props, user } = setup();
      await user.click(csvButton());

      await user.click(await screen.findByRole('button', { name: 'Cancel' }));

      expect(props.onExportCsv).not.toHaveBeenCalled();
    });

    it('shows an error toast when the file cannot be created', async () => {
      const { user } = setup({
        onExportCsv: vi.fn(() => {
          throw new Error('nope');
        }),
      });
      await user.click(csvButton());

      await user.click(await screen.findByRole('button', { name: 'Download CSV' }));

      expect(await screen.findByText(/Couldn't create the CSV/)).toBeInTheDocument();
    });
  });
});
