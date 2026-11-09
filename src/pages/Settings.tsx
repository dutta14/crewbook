import { useState } from 'react';
import { ChangePassphrase } from '../components/ChangePassphrase';
import { ClearAllData } from '../components/ClearAllData';
import { CustomFieldSettings } from '../components/CustomFieldSettings';
import { DataManagement } from '../components/DataManagement';
import { GeneralSettings } from '../components/GeneralSettings';
import { LeadTimeSettings } from '../components/LeadTimeSettings';
import { PrivacySettings } from '../components/PrivacySettings';
import { useCustomFields } from '../hooks/useCustomFields';
import '../styles/settings.css';

/**
 * Remounts the sections after a restore or a clear, so forms that copied a setting into a draft
 * reload it. The reminder after a clear lives here so it survives that remount.
 */
export function Settings() {
  const [reloadCount, setReloadCount] = useState(0);
  const [hasCleared, setHasCleared] = useState(false);
  const reload = () => setReloadCount((count) => count + 1);
  return (
    <SettingsContent
      key={reloadCount}
      hasCleared={hasCleared}
      onRestored={() => {
        setHasCleared(false);
        reload();
      }}
      onCleared={() => {
        setHasCleared(true);
        reload();
      }}
    />
  );
}

interface SettingsContentProps {
  hasCleared: boolean;
  onRestored: () => void;
  onCleared: () => void;
}

function SettingsContent({ hasCleared, onRestored, onCleared }: SettingsContentProps) {
  const customFields = useCustomFields();

  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <GeneralSettings />
      <PrivacySettings />
      <LeadTimeSettings />
      <CustomFieldSettings
        definitions={customFields.definitions}
        getAffectedCount={customFields.countAffectedMembers}
        onAddField={customFields.addField}
        onEditField={customFields.editField}
        onRemoveField={customFields.removeField}
        onReorder={customFields.reorderFields}
      />
      <section className="settings-section" aria-labelledby="settings-data-heading">
        <h2 id="settings-data-heading" className="settings-section__title">
          Data Management
        </h2>
        <DataManagement onRestored={onRestored} />
        <ChangePassphrase />
        <ClearAllData showReminder={hasCleared} onCleared={onCleared} />
      </section>
    </div>
  );
}
