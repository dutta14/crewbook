import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { createMember, createNote } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import * as download from '../utils/downloadFile';
import { DataManagement } from './DataManagement';

vi.mock('../utils/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/crypto')>();
  const { fastDeriveKey } = await import('../test-utils/fastCrypto');
  return { ...actual, deriveKey: fastDeriveKey };
});

const PASSPHRASE = 'test passphrase';
const ada = createMember({ id: 'ada', name: 'Ada Lovelace', email: 'ada@example.com' });
const grace = createMember({ id: 'grace', name: 'Grace Hopper', email: 'grace@example.com' });

function Probe() {
  const { get, getPrivate } = useEncryptedStorage();
  const members = get<{ name: string }[]>('members') ?? [];
  const notes = getPrivate<{ content: string }[]>('notes') ?? [];
  return (
    <>
      <output aria-label="Members">{members.map((member) => member.name).join(',')}</output>
      <output aria-label="Notes">{notes.map((note) => note.content).join(',')}</output>
    </>
  );
}

let saved: { content: string; fileName: string }[];

beforeEach(() => {
  saved = [];
  vi.spyOn(download, 'downloadFile').mockImplementation((content, fileName) => {
    saved.push({ content, fileName });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const renderManagement = (onRestored?: () => void) =>
  renderWithProviders(
    <>
      <DataManagement onRestored={onRestored} />
      <Probe />
    </>,
    {
      initialData: { members: [ada, grace] },
      initialPrivateData: { notes: [createNote({ memberId: 'ada', content: 'secret note' })] },
      passphrase: PASSPHRASE,
    },
  );

async function exportBackup(user: ReturnType<typeof userEvent.setup>, passphrase = PASSPHRASE) {
  await user.click(screen.getByRole('button', { name: 'Export Data' }));
  await user.type(await screen.findByLabelText(/Passphrase/), `${passphrase}{Enter}`);
}

describe('DataManagement', () => {
  it('saves an encrypted backup and shows when it was made', async () => {
    const user = userEvent.setup();
    renderManagement();

    await exportBackup(user);

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].fileName).toMatch(/^crewbook-backup-\d{4}-\d{2}-\d{2}\.json\.enc$/);
    expect(saved[0].content).not.toContain('Ada Lovelace');
    expect(saved[0].content).not.toContain('secret note');
    await waitFor(() => expect(screen.queryByText('Last backup: Never')).not.toBeInTheDocument());
    expect(screen.getByText(/^Last backup: /)).toBeInTheDocument();
  });

  it('does not save a file when the passphrase is not the one that unlocks Crewbook', async () => {
    const user = userEvent.setup();
    renderManagement();

    await exportBackup(user, 'a typo');

    await waitFor(() =>
      expect(screen.getByLabelText(/Passphrase/)).toHaveAccessibleDescription(
        /isn't the passphrase/,
      ),
    );
    expect(saved).toHaveLength(0);
    expect(screen.getByText('Last backup: Never')).toBeInTheDocument();
  });

  it('downloads a roster CSV with only the roster columns', async () => {
    const user = userEvent.setup();
    renderManagement();

    await user.click(screen.getByRole('button', { name: 'Download CSV (Unencrypted)' }));
    await user.click(await screen.findByRole('button', { name: 'Download CSV' }));

    expect(saved).toHaveLength(1);
    expect(saved[0].fileName).toMatch(/^crewbook-roster-.*\.csv$/);
    const lines = saved[0].content.replace('\uFEFF', '').split('\r\n');
    expect(lines[0]).toBe('name,role,level,email,status');
    expect(lines[1]).toContain('Ada Lovelace');
    expect(saved[0].content).not.toContain('secret note');
  });

  it('restores everything from a backup it made, replacing what is there now', async () => {
    const user = userEvent.setup();
    const onRestored = vi.fn();
    renderManagement(onRestored);
    await exportBackup(user);
    await waitFor(() => expect(saved).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const contentAtExport = saved[0].content;
    const { unmount } = renderWithProviders(
      <>
        <DataManagement onRestored={onRestored} />
        <Probe />
      </>,
      { initialData: { members: [createMember({ id: 'x', name: 'Someone Else' })] } },
    );
    const inputs = screen.getAllByLabelText('Select backup file to import');
    await userEvent
      .setup({ applyAccept: false })
      .upload(inputs[inputs.length - 1], new File([contentAtExport], saved[0].fileName));
    const dialog = await screen.findByRole('dialog', { name: 'Backup passphrase' });
    await user.type(dialog.querySelector('input') as HTMLInputElement, `${PASSPHRASE}{Enter}`);
    await screen.findByRole('alertdialog', { name: 'Import Backup' });
    expect(screen.getByRole('alertdialog')).toHaveTextContent('2 team members');
    await user.click(screen.getByRole('button', { name: 'Replace All Data' }));

    expect(await screen.findByText('Data imported successfully')).toBeInTheDocument();
    expect(onRestored).toHaveBeenCalled();
    const members = screen.getAllByLabelText('Members');
    expect(members[members.length - 1]).toHaveTextContent('Ada Lovelace,Grace Hopper');
    const notes = screen.getAllByLabelText('Notes');
    expect(notes[notes.length - 1]).toHaveTextContent('secret note');
    unmount();
  });
});
