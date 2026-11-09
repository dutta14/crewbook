import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { BackupDecryptError, BackupTooLargeError, type BackupContainer } from '../utils/backupFile';
import type { BackupData } from '../utils/backupSchema';
import { BackupValidationError } from '../utils/schemaCheck';
import { DataImport, type DataImportProps } from './DataImport';

const CONTAINER = {
  salt: new Uint8Array(16),
  envelope: { v: 1, iv: 'x', ct: 'y', iterations: 310000 },
} as BackupContainer;

function backup(overrides: Partial<BackupData> = {}): BackupData {
  const member = { id: 'm1' };
  return {
    version: 1,
    exportedAt: '2025-06-01T10:00:00.000Z',
    privateDataIncluded: true,
    main: { members: [member, { id: 'm2' }, { id: 'm3' }], sharedNotes: [{ id: 's1' }] },
    private: { notes: [{ id: 'n1' }, { id: 'n2' }], actionItems: [{ id: 'a1' }] },
    ...overrides,
  };
}

function setup(overrides: Partial<DataImportProps> = {}) {
  const props: DataImportProps = {
    checkFile: vi.fn(async () => CONTAINER),
    readFile: vi.fn(async () => backup()),
    onImport: vi.fn(async (_data, onProgress) => onProgress(1)),
    onImported: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup({ applyAccept: false });
  renderWithProviders(<DataImport {...props} />);
  return { props, user };
}

const file = (name = 'crewbook-backup-2025-06-01.json.enc') => new File(['data'], name);
const chooseFile = (user: ReturnType<typeof userEvent.setup>, chosen = file()) =>
  user.upload(screen.getByLabelText('Select backup file to import'), chosen);
const importButton = () => screen.getByRole('button', { name: 'Import Data' });

async function reachPreview(props: Partial<DataImportProps> = {}) {
  const view = setup(props);
  await chooseFile(view.user);
  await view.user.type(await screen.findByLabelText(/Passphrase/), 'backup pass{Enter}');
  await screen.findByRole('alertdialog', { name: 'Import Backup' });
  return view;
}

describe('DataImport', () => {
  it('offers an Import Data button and a file input that accepts only backup files', () => {
    setup();

    expect(importButton()).toBeEnabled();
    const input = screen.getByLabelText('Select backup file to import');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', '.json.enc');
  });

  it('opens the file picker from the button', async () => {
    const { user } = setup();
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');

    await user.click(importButton());

    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  describe('choosing a file', () => {
    it('shows an error toast and no dialog for a file over 10 MB', async () => {
      const { user } = setup({
        checkFile: vi.fn(async () => {
          throw new BackupTooLargeError();
        }),
      });

      await chooseFile(user);

      expect(await screen.findByText(/larger than 10 MB/)).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows the invalid file message with only a Close button', async () => {
      const { user } = setup({
        checkFile: vi.fn(async () => {
          throw new BackupValidationError('This file is not a valid Crewbook backup.');
        }),
      });

      await chooseFile(user, file('notes.txt'));

      const dialog = await screen.findByRole('dialog', { name: 'Import Backup' });
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'This file is not a valid Crewbook backup.',
      );
      expect(dialog).not.toHaveTextContent('Replace All Data');
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('shows a toast when the file cannot be read at all', async () => {
      const { user } = setup({
        checkFile: vi.fn(async () => {
          throw new Error('unreadable');
        }),
      });

      await chooseFile(user);

      expect(await screen.findByText(/Couldn't read that backup/)).toBeInTheDocument();
    });

    it('does nothing when the picker is cancelled', async () => {
      const { props } = setup();

      screen
        .getByLabelText('Select backup file to import')
        .dispatchEvent(new Event('change', { bubbles: true }));

      expect(props.checkFile).not.toHaveBeenCalled();
    });

    it('lets the same file be chosen again', async () => {
      const { user } = setup();
      const input = screen.getByLabelText('Select backup file to import') as HTMLInputElement;

      await chooseFile(user);

      expect(input.value).toBe('');
    });
  });

  describe('the passphrase step', () => {
    it('asks for the backup passphrase and puts focus in the field', async () => {
      const { user } = setup();

      await chooseFile(user);

      expect(await screen.findByRole('dialog', { name: 'Backup passphrase' })).toBeInTheDocument();
      expect(screen.getByLabelText(/Passphrase/)).toHaveFocus();
    });

    it('asks again instead of continuing when the field is empty', async () => {
      const { props, user } = setup();
      await chooseFile(user);

      await user.click(await screen.findByRole('button', { name: 'Open backup' }));

      expect(screen.getByLabelText(/Passphrase/)).toHaveAccessibleDescription(
        "Enter the backup's passphrase.",
      );
      expect(props.readFile).not.toHaveBeenCalled();
    });

    it('shows an inline retry message for a wrong passphrase or a changed file', async () => {
      const { user } = setup({
        readFile: vi.fn(async () => {
          throw new BackupDecryptError();
        }),
      });
      await chooseFile(user);

      await user.type(await screen.findByLabelText(/Passphrase/), 'wrong{Enter}');

      const field = screen.getByLabelText(/Passphrase/);
      await waitFor(() => expect(field).toHaveAccessibleDescription(/didn't open this backup/));
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('shows the invalid file message when the decrypted contents are not a valid backup', async () => {
      const { user } = setup({
        readFile: vi.fn(async () => {
          throw new BackupValidationError("Invalid field 'name' in team members at index 2");
        }),
      });
      await chooseFile(user);

      await user.type(await screen.findByLabelText(/Passphrase/), 'right{Enter}');

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('This file is not a valid Crewbook backup.');
      expect(alert).toHaveTextContent("Invalid field 'name' in team members at index 2");
    });

    it('shows a general retry message for any other failure', async () => {
      const { user } = setup({
        readFile: vi.fn(async () => {
          throw new Error('boom');
        }),
      });
      await chooseFile(user);

      await user.type(await screen.findByLabelText(/Passphrase/), 'x{Enter}');

      await waitFor(() =>
        expect(screen.getByLabelText(/Passphrase/)).toHaveAccessibleDescription(
          /Couldn't read that backup/,
        ),
      );
    });

    it('cancels without importing anything', async () => {
      const { props, user } = setup();
      await chooseFile(user);

      await user.click(await screen.findByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(props.onImport).not.toHaveBeenCalled();
    });
  });

  describe('the preview', () => {
    it('lists what the backup contains and warns that everything will be replaced', async () => {
      await reachPreview();

      const dialog = screen.getByRole('alertdialog', { name: 'Import Backup' });
      expect(dialog).toHaveTextContent('3 team members');
      expect(dialog).toHaveTextContent('3 notes');
      expect(dialog).toHaveTextContent('1 action item');
      expect(dialog).toHaveTextContent('It includes private data.');
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Importing will replace all current data. This cannot be undone.',
      );
      expect(dialog).toHaveAccessibleDescription(
        'Importing will replace all current data. This cannot be undone.',
      );
    });

    it('starts with focus on Cancel so Enter cannot replace data by accident', async () => {
      await reachPreview();

      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });

    it('warns that private data will be emptied when the backup has none', async () => {
      await reachPreview({
        readFile: vi.fn(async () => backup({ privateDataIncluded: false, private: {} })),
      });

      expect(screen.getByRole('alertdialog')).toHaveTextContent(/does not include private data/);
      expect(screen.getByRole('alertdialog')).toHaveTextContent(/replaced with nothing/);
    });

    it('closes on Escape, imports nothing, and returns focus to Import Data', async () => {
      const { props, user } = await reachPreview();

      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(props.onImport).not.toHaveBeenCalled();
      expect(importButton()).toHaveFocus();
    });

    it('closes with Cancel and imports nothing', async () => {
      const { props, user } = await reachPreview();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(props.onImport).not.toHaveBeenCalled();
    });

    it('has no accessibility violations', async () => {
      await reachPreview();

      expect(await axe(screen.getByRole('alertdialog'))).toHaveNoViolations();
    });
  });

  describe('replacing the data', () => {
    it('imports the backup, shows progress, then confirms and tells the page', async () => {
      let report: (fraction: number) => void = () => undefined;
      let finish: () => void = () => undefined;
      const onImport = vi.fn(
        (_data: BackupData, onProgress: (fraction: number) => void) =>
          new Promise<void>((resolve) => {
            report = onProgress;
            finish = resolve;
          }),
      );
      const { props, user } = await reachPreview({ onImport });

      await user.click(screen.getByRole('button', { name: 'Replace All Data' }));

      const progress = await screen.findByRole('progressbar', { name: 'Import progress' });
      expect(progress).toHaveAttribute('value', '0');
      report(0.6);
      await waitFor(() => expect(progress).toHaveAttribute('value', '60'));
      finish();
      expect(await screen.findByText('Data imported successfully')).toBeInTheDocument();
      expect(props.onImported).toHaveBeenCalledTimes(1);
      expect(onImport.mock.calls[0][0].main.members).toHaveLength(3);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('shows the reason and says the data is unchanged when the import fails', async () => {
      const { props, user } = await reachPreview({
        onImport: vi.fn(async () => {
          throw new Error('Storage is full');
        }),
      });

      await user.click(screen.getByRole('button', { name: 'Replace All Data' }));

      expect(
        await screen.findByText('Import failed: Storage is full. Your existing data is unchanged.'),
      ).toBeInTheDocument();
      expect(props.onImported).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('cannot be dismissed with Escape while importing', async () => {
      const onImport = vi.fn(() => new Promise<void>(() => undefined));
      const { user } = await reachPreview({ onImport });
      await user.click(screen.getByRole('button', { name: 'Replace All Data' }));
      await screen.findByRole('progressbar');

      await user.keyboard('{Escape}');

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });
});
