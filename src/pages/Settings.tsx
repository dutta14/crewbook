import { useState } from 'react';
import { CustomFieldSettings } from '../components/CustomFieldSettings';
import { DataManagement } from '../components/DataManagement';
import { DefaultVisibilitySetting } from '../components/DefaultVisibilitySetting';
import { LeadTimeSettings } from '../components/LeadTimeSettings';
import { SettingsSwitchRow } from '../components/SettingsSwitchRow';
import {
  areRiskIndicatorsHidden,
  isMoodTrackingEnabled,
  setMoodTrackingEnabled,
  setRiskIndicatorsHidden,
} from '../data/settings';
import { useCustomFields } from '../hooks/useCustomFields';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useToast } from '../hooks/useToast';
import '../styles/settings.css';

const SAVE_FAILED = "Couldn't save that setting. Try again.";

/** Remounts the sections after a restore, so forms that copied a setting into a draft reload it. */
export function Settings() {
  const [restoreCount, setRestoreCount] = useState(0);
  return (
    <SettingsContent key={restoreCount} onRestored={() => setRestoreCount((count) => count + 1)} />
  );
}

function SettingsContent({ onRestored }: { onRestored: () => void }) {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const customFields = useCustomFields();

  const save = async (write: () => Promise<void>) => {
    try {
      await write();
    } catch {
      showToast(SAVE_FAILED, 'error');
    }
  };

  return (
    <>
      <h1>Settings</h1>
      <section className="settings-section" aria-labelledby="settings-privacy-heading">
        <h2 id="settings-privacy-heading" className="settings-section__title">
          Privacy
        </h2>
        <SettingsSwitchRow
          label="Track energy/mood after 1:1s"
          description="Only visible to you. Never shared."
          checked={isMoodTrackingEnabled(storage)}
          onChange={(next) => void save(() => setMoodTrackingEnabled(next, storage))}
        />
        <SettingsSwitchRow
          label="Hide risk indicators"
          description="Hides the dots on the roster, for example while sharing your screen. Your private notes stay saved."
          checked={areRiskIndicatorsHidden(storage)}
          onChange={(next) => void save(() => setRiskIndicatorsHidden(next, storage))}
        />
        <DefaultVisibilitySetting />
      </section>
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
      </section>
    </>
  );
}
