import { useState } from 'react';
import { countMoodEntries, deleteAllMoodEntries } from '../data/moodEntries';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../hooks/useToast';
import { AUTO_LOCK_OPTIONS, type PrivateAutoLockTimeout } from '../types/settings';
import { DefaultVisibilitySetting } from './DefaultVisibilitySetting';
import { MoodPurgePrompt } from './MoodPurgePrompt';
import { SettingsSelectRow } from './SettingsSelectRow';
import { SettingsSwitchRow } from './SettingsSwitchRow';
import '../styles/settings.css';

const AUTO_LOCK_CHOICES = AUTO_LOCK_OPTIONS.map((minutes) => ({
  value: String(minutes),
  label: minutes === 0 ? 'Never' : `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
}));

/** What is kept private, and how long private views stay open. */
export function PrivacySettings() {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const { settings, saveSetting } = useSettings();
  const [purgeCount, setPurgeCount] = useState(0);
  const [isPurgeOpen, setIsPurgeOpen] = useState(false);

  const handleMoodChange = async (next: boolean) => {
    await saveSetting('moodTrackingEnabled', next);
    if (next) return;
    try {
      await storage.loadPrivate();
      const count = countMoodEntries(storage);
      if (count > 0) {
        setPurgeCount(count);
        setIsPurgeOpen(true);
      }
    } catch {
      // The private envelope could not be read, so there is nothing to offer to delete.
    }
  };

  const purge = async () => {
    setIsPurgeOpen(false);
    try {
      await deleteAllMoodEntries(storage);
      showToast('Mood entries deleted', 'success');
    } catch {
      showToast("Couldn't delete the mood entries. Try again.", 'error');
    }
  };

  return (
    <section className="settings-section" aria-labelledby="settings-privacy-heading">
      <h2 id="settings-privacy-heading" className="settings-section__title">
        Privacy
      </h2>
      <SettingsSwitchRow
        label="Track energy/mood after 1:1s"
        description="Only visible to you. Never shared."
        checked={settings.moodTrackingEnabled}
        onChange={handleMoodChange}
      />
      <SettingsSwitchRow
        label="Hide risk indicators"
        description="Hides the dots on the roster, for example while sharing your screen. Your private notes stay saved."
        checked={settings.hideRiskIndicators}
        onChange={(next) => saveSetting('hideRiskIndicators', next)}
      />
      <DefaultVisibilitySetting />
      <SettingsSelectRow
        label="Private data auto-lock"
        description="Closes the Private Notes section on a person's page after this long without activity. Never still closes it when you switch tabs."
        value={String(settings.privateAutoLockMinutes)}
        options={AUTO_LOCK_CHOICES}
        onChange={(value) =>
          saveSetting('privateAutoLockMinutes', Number(value) as PrivateAutoLockTimeout)
        }
      />
      <MoodPurgePrompt
        isOpen={isPurgeOpen}
        count={purgeCount}
        onKeep={() => setIsPurgeOpen(false)}
        onDelete={() => void purge()}
      />
    </section>
  );
}
