import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import { WrongPassphraseError } from './encryptedStorage';
import { backupFileName, BackupTooLargeError, MAX_BACKUP_BYTES, sealBackup } from './backupFile';
import { createBackup, summarizePrivateData, toBackupJson, type BackupData } from './backupSchema';
import { downloadFile } from './downloadFile';
import type { CountLine } from '../data/envelopeSchema';

export type ExportStorage = Pick<
  EncryptedStorageContextValue,
  'exportSnapshot' | 'verifyPassphrase'
>;

export interface ExportPreview {
  /** False when the private envelope could not be read, so the backup will leave it out. */
  privateAvailable: boolean;
  privateCounts: CountLine[];
}

export interface ExportResult {
  fileName: string;
  privateDataIncluded: boolean;
  exportedAt: string;
}

/** What the person is about to put into a file, for the warning shown before they confirm. */
export async function getExportPreview(
  storage: Pick<ExportStorage, 'exportSnapshot'>,
): Promise<ExportPreview> {
  const snapshot = await storage.exportSnapshot();
  return {
    privateAvailable: snapshot.private !== null,
    privateCounts: summarizePrivateData(snapshot),
  };
}

/**
 * Builds the backup, encrypts it under `passphrase` and saves it as a file. The passphrase must be
 * the one that unlocks this browser, so a typo cannot produce a file nobody can open. The plain
 * text exists only inside this function.
 */
export async function exportFullBackup(
  passphrase: string,
  storage: ExportStorage,
  now: Date = new Date(),
): Promise<ExportResult> {
  if (!(await storage.verifyPassphrase(passphrase))) throw new WrongPassphraseError();
  const snapshot = await storage.exportSnapshot();
  const backup: BackupData = createBackup(snapshot, now);
  const sealed = await sealBackup(toBackupJson(backup), passphrase);
  if (sealed.length > MAX_BACKUP_BYTES) throw new BackupTooLargeError();
  const fileName = backupFileName(now);
  downloadFile(sealed, fileName, 'application/octet-stream');
  return {
    fileName,
    privateDataIncluded: backup.privateDataIncluded,
    exportedAt: backup.exportedAt,
  };
}
