import type { EncryptedStorageContextValue } from '../components/EncryptedStorageProvider';
import {
  BackupTooLargeError,
  hasBackupExtension,
  MAX_BACKUP_BYTES,
  NOT_A_BACKUP_MESSAGE,
  openBackup,
  readContainer,
  type BackupContainer,
} from './backupFile';
import { parseBackup, type BackupData } from './backupSchema';
import { BackupValidationError } from './schemaCheck';

export type ImportStorage = Pick<EncryptedStorageContextValue, 'replaceAll'>;

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * First look at a chosen file, before any passphrase. The size is checked before the file is read,
 * and only the outer envelope is parsed. Throws BackupTooLargeError or BackupValidationError.
 */
export async function inspectBackupFile(file: File): Promise<BackupContainer> {
  if (file.size > MAX_BACKUP_BYTES) throw new BackupTooLargeError();
  if (!hasBackupExtension(file.name)) throw new BackupValidationError(NOT_A_BACKUP_MESSAGE);
  return readContainer(await readAsText(file));
}

/**
 * Decrypts with the backup's passphrase, then parses and strictly validates what is inside. Throws
 * BackupDecryptError for a wrong passphrase or a changed file, BackupValidationError for contents
 * the app will not accept. Nothing is stored here.
 */
export async function readBackup(
  container: BackupContainer,
  passphrase: string,
): Promise<BackupData> {
  const plaintext = await openBackup(container, passphrase);
  return parseBackup(plaintext);
}

/** Swaps all current data for the backup's in one step; the old data survives any failure. */
export function restoreBackup(
  data: BackupData,
  storage: ImportStorage,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return storage.replaceAll(
    { main: data.main, private: data.privateDataIncluded ? data.private : {} },
    onProgress,
  );
}
