import { getLastBackupAt, setLastBackupAt } from '../data/settings';
import { listMembers } from '../data/members';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { exportFullBackup, getExportPreview } from '../utils/exportBackup';
import { exportRosterCsv } from '../utils/exportCSV';
import { inspectBackupFile, readBackup, restoreBackup } from '../utils/importBackup';
import { DataExport } from './DataExport';
import { DataImport } from './DataImport';

interface DataManagementProps {
  /** Called after a restore replaces the data, so the page can reload what it shows. */
  onRestored?: () => void;
}

/** The backup, CSV and restore controls. Settings mounts it; it holds no layout of its own. */
export function DataManagement({ onRestored }: DataManagementProps) {
  const storage = useEncryptedStorage();

  const handleExport = async (passphrase: string) => {
    const result = await exportFullBackup(passphrase, storage);
    // The file is already saved, so a failure to note the date must not fail the export.
    await setLastBackupAt(result.exportedAt, storage).catch(() => undefined);
    return result;
  };

  return (
    <div className="data-management">
      <DataExport
        lastBackupAt={getLastBackupAt(storage) ?? null}
        getPreview={() => getExportPreview(storage)}
        onExport={handleExport}
        onExportCsv={() => exportRosterCsv(listMembers(storage))}
      />
      <DataImport
        checkFile={inspectBackupFile}
        readFile={readBackup}
        onImport={(data, onProgress) => restoreBackup(data, storage, onProgress)}
        onImported={onRestored}
      />
    </div>
  );
}
