import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMember, createNote } from '../test-utils/factories';
import {
  BACKUP_EXTENSION,
  BackupDecryptError,
  BackupTooLargeError,
  MAX_BACKUP_BYTES,
  NOT_A_BACKUP_MESSAGE,
  backupFileName,
  hasBackupExtension,
  openBackup,
  readContainer,
  sealBackup,
} from './backupFile';
import type { DataSnapshot } from './backupSchema';
import * as download from './downloadFile';
import { WrongPassphraseError } from './encryptedStorage';
import { exportFullBackup, getExportPreview, type ExportStorage } from './exportBackup';
import { inspectBackupFile, readBackup, restoreBackup } from './importBackup';
import { BackupValidationError } from './schemaCheck';

vi.mock('./crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./crypto')>();
  const { fastDeriveKey } = await import('../test-utils/fastCrypto');
  return { ...actual, deriveKey: fastDeriveKey };
});

const PASSPHRASE = 'correct horse battery staple';
const NOW = new Date(2025, 5, 1, 10, 0, 0);

const member = createMember({ id: 'm1' });
const snapshot: DataSnapshot = {
  main: { members: [member] },
  private: { notes: [createNote({ id: 'n1', memberId: 'm1' })] },
};

function fakeStorage(overrides: Partial<ExportStorage> = {}): ExportStorage {
  return {
    exportSnapshot: vi.fn(async () => snapshot),
    verifyPassphrase: vi.fn(async (value: string) => value === PASSPHRASE),
    ...overrides,
  };
}

let saved: { content: string; fileName: string; mimeType: string } | null;

beforeEach(() => {
  saved = null;
  vi.spyOn(download, 'downloadFile').mockImplementation((content, fileName, mimeType) => {
    saved = { content, fileName, mimeType };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sealBackup and openBackup', () => {
  it('opens a sealed backup with the same passphrase', async () => {
    const sealed = await sealBackup('{"hello":"world"}', PASSPHRASE);

    expect(await openBackup(readContainer(sealed), PASSPHRASE)).toBe('{"hello":"world"}');
  });

  it('does not put the plain text in the file', async () => {
    const sealed = await sealBackup('visible-marker', PASSPHRASE);

    expect(sealed).not.toContain('visible-marker');
  });

  it('uses a new salt and IV every time', async () => {
    const first = JSON.parse(await sealBackup('x', PASSPHRASE)) as { salt: string; iv: string };
    const second = JSON.parse(await sealBackup('x', PASSPHRASE)) as { salt: string; iv: string };

    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
  });

  it('refuses a wrong passphrase', async () => {
    const sealed = await sealBackup('x', PASSPHRASE);

    await expect(openBackup(readContainer(sealed), 'wrong')).rejects.toBeInstanceOf(
      BackupDecryptError,
    );
  });

  it('refuses a file whose encrypted part was changed', async () => {
    const file = JSON.parse(await sealBackup('some longer text to encrypt', PASSPHRASE)) as {
      ct: string;
    };
    const flipped = file.ct.startsWith('A') ? `B${file.ct.slice(1)}` : `A${file.ct.slice(1)}`;

    await expect(
      openBackup(readContainer(JSON.stringify({ ...file, ct: flipped })), PASSPHRASE),
    ).rejects.toBeInstanceOf(BackupDecryptError);
  });
});

describe('readContainer', () => {
  const valid = async () =>
    JSON.parse(await sealBackup('x', PASSPHRASE)) as Record<string, unknown>;

  it.each(['', 'not json', '[]', 'null', '{}'])('rejects %j as a backup', (text) => {
    expect(() => readContainer(text)).toThrow(NOT_A_BACKUP_MESSAGE);
  });

  it('rejects an unknown field in the outer file', async () => {
    const file = { ...(await valid()), extra: 1 };

    expect(() => readContainer(JSON.stringify(file))).toThrow(BackupValidationError);
  });

  it('rejects another format name', async () => {
    const file = { ...(await valid()), format: 'something-else' };

    expect(() => readContainer(JSON.stringify(file))).toThrow(NOT_A_BACKUP_MESSAGE);
  });

  it('tells the person to update when the file is from a newer version', async () => {
    const file = { ...(await valid()), v: 2 };

    expect(() => readContainer(JSON.stringify(file))).toThrow(/newer version/);
  });

  it.each([1, 309_999, 100_000_000, 'many'])('rejects %j key-stretching rounds', async (rounds) => {
    const file = { ...(await valid()), iterations: rounds };

    expect(() => readContainer(JSON.stringify(file))).toThrow(BackupValidationError);
  });

  it('rejects a salt of the wrong length', async () => {
    const file = { ...(await valid()), salt: 'AAAA' };

    expect(() => readContainer(JSON.stringify(file))).toThrow(NOT_A_BACKUP_MESSAGE);
  });

  it('rejects text far larger than the size limit without parsing it', () => {
    expect(() => readContainer('x'.repeat(MAX_BACKUP_BYTES * 2 + 1))).toThrow(BackupTooLargeError);
  });
});

describe('file names', () => {
  it('names a backup by the local date', () => {
    expect(backupFileName(new Date(2025, 0, 5))).toBe('crewbook-backup-2025-01-05.json.enc');
  });

  it('accepts the backup extension in any letter case', () => {
    expect(hasBackupExtension(`Plan${BACKUP_EXTENSION.toUpperCase()}`)).toBe(true);
  });

  it.each(['backup.json', 'backup.enc', 'backup.csv', 'backup'])('rejects %s', (name) => {
    expect(hasBackupExtension(name)).toBe(false);
  });
});

describe('exportFullBackup', () => {
  it('saves one encrypted file that holds the data and the private data', async () => {
    const result = await exportFullBackup(PASSPHRASE, fakeStorage(), NOW);

    expect(result).toEqual({
      fileName: 'crewbook-backup-2025-06-01.json.enc',
      privateDataIncluded: true,
      exportedAt: NOW.toISOString(),
    });
    expect(saved?.fileName).toBe(result.fileName);
    expect(saved?.content).not.toContain(member.name);
    const plain = await openBackup(readContainer(saved?.content ?? ''), PASSPHRASE);
    expect(JSON.parse(plain)).toMatchObject({ privateDataIncluded: true, notes: [{ id: 'n1' }] });
  });

  it('refuses a passphrase that does not unlock Crewbook and saves nothing', async () => {
    await expect(exportFullBackup('typo', fakeStorage(), NOW)).rejects.toBeInstanceOf(
      WrongPassphraseError,
    );
    expect(saved).toBeNull();
  });

  it('leaves private data out and says so when it could not be read', async () => {
    const storage = fakeStorage({
      exportSnapshot: vi.fn(async () => ({ main: snapshot.main, private: null })),
    });

    const result = await exportFullBackup(PASSPHRASE, storage, NOW);

    expect(result.privateDataIncluded).toBe(false);
    const plain = JSON.parse(await openBackup(readContainer(saved?.content ?? ''), PASSPHRASE));
    expect(plain).not.toHaveProperty('notes');
  });

  it('refuses to save a file over the size limit', async () => {
    const big = 'x'.repeat(MAX_BACKUP_BYTES);
    const storage = fakeStorage({
      exportSnapshot: vi.fn(async () => ({
        main: { members: [{ ...member, role: big }] },
        private: {},
      })),
    });

    await expect(exportFullBackup(PASSPHRASE, storage, NOW)).rejects.toBeDefined();
    expect(saved).toBeNull();
  });
});

describe('getExportPreview', () => {
  it('counts private records and says the private data is available', async () => {
    const preview = await getExportPreview(fakeStorage());

    expect(preview.privateAvailable).toBe(true);
    expect(preview.privateCounts).toEqual([{ id: 'notes', count: 1, label: 'note' }]);
  });

  it('says the private data is not available when it cannot be read', async () => {
    const preview = await getExportPreview(
      fakeStorage({ exportSnapshot: vi.fn(async () => ({ main: {}, private: null })) }),
    );

    expect(preview).toEqual({ privateAvailable: false, privateCounts: [] });
  });
});

describe('importing a file', () => {
  const makeFile = (content: string, name = 'crewbook-backup.json.enc') =>
    new File([content], name, { type: 'application/octet-stream' });

  it('goes from an exported file to the same data in the store', async () => {
    await exportFullBackup(PASSPHRASE, fakeStorage(), NOW);
    const container = await inspectBackupFile(makeFile(saved?.content ?? ''));
    const backup = await readBackup(container, PASSPHRASE);
    const replaceAll = vi.fn(async () => undefined);

    await restoreBackup(backup, { replaceAll });

    expect(replaceAll).toHaveBeenCalledTimes(1);
    const [next] = replaceAll.mock.calls[0] as unknown as [DataSnapshot];
    expect(next.main.members).toEqual([member]);
    expect(next.private?.notes).toEqual(snapshot.private?.notes);
  });

  it('replaces the private data with nothing when the backup has none', async () => {
    const storage = fakeStorage({
      exportSnapshot: vi.fn(async () => ({ main: snapshot.main, private: null })),
    });
    await exportFullBackup(PASSPHRASE, storage, NOW);
    const backup = await readBackup(
      await inspectBackupFile(makeFile(saved?.content ?? '')),
      PASSPHRASE,
    );
    const replaceAll = vi.fn(async () => undefined);

    await restoreBackup(backup, { replaceAll });

    expect((replaceAll.mock.calls[0] as unknown as [DataSnapshot])[0].private).toEqual({});
  });

  it('passes progress through to the store', async () => {
    await exportFullBackup(PASSPHRASE, fakeStorage(), NOW);
    const backup = await readBackup(
      await inspectBackupFile(makeFile(saved?.content ?? '')),
      PASSPHRASE,
    );
    const onProgress = vi.fn();
    const replaceAll = vi.fn(async (_next: DataSnapshot, report?: (fraction: number) => void) =>
      report?.(0.5),
    );

    await restoreBackup(backup, { replaceAll }, onProgress);

    expect(onProgress).toHaveBeenCalledWith(0.5);
  });

  it('rejects a file larger than 10 MB before reading it', async () => {
    const file = makeFile('x');
    Object.defineProperty(file, 'size', { value: MAX_BACKUP_BYTES + 1 });
    const read = vi.spyOn(FileReader.prototype, 'readAsText');

    await expect(inspectBackupFile(file)).rejects.toBeInstanceOf(BackupTooLargeError);
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects a file without the backup extension', async () => {
    await expect(inspectBackupFile(makeFile('{}', 'notes.json'))).rejects.toThrow(
      NOT_A_BACKUP_MESSAGE,
    );
  });

  it('rejects a file with the right name but other contents', async () => {
    await expect(inspectBackupFile(makeFile('just some text'))).rejects.toThrow(
      NOT_A_BACKUP_MESSAGE,
    );
  });

  it('rejects an encrypted file whose contents are not a valid backup', async () => {
    const sealed = await sealBackup('{"version":1}', PASSPHRASE);

    await expect(readBackup(readContainer(sealed), PASSPHRASE)).rejects.toBeInstanceOf(
      BackupValidationError,
    );
  });

  it('rejects a wrong passphrase with a decrypt error', async () => {
    await exportFullBackup(PASSPHRASE, fakeStorage(), NOW);
    const container = await inspectBackupFile(makeFile(saved?.content ?? ''));

    await expect(readBackup(container, 'wrong')).rejects.toBeInstanceOf(BackupDecryptError);
  });
});
