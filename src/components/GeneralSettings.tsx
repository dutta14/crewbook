import { useDarkMode } from '../hooks/useDarkMode';
import { useSettings } from '../hooks/useSettings';
import {
  CADENCE_OPTIONS,
  DATE_FORMATS,
  FIRST_DAYS_OF_WEEK,
  type CadenceOption,
  type DateFormat,
  type FirstDayOfWeek,
} from '../types/settings';
import { SettingsSelectRow, type SettingsSelectOption } from './SettingsSelectRow';
import { SettingsSwitchRow } from './SettingsSwitchRow';
import '../styles/settings.css';

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const toOptions = (values: readonly string[]): SettingsSelectOption[] =>
  values.map((value) => ({ value, label: capitalise(value) }));

const CADENCE_CHOICES = toOptions(CADENCE_OPTIONS);
const DATE_FORMAT_CHOICES = DATE_FORMATS.map((value) => ({ value, label: value }));
const FIRST_DAY_CHOICES = toOptions(FIRST_DAYS_OF_WEEK);

/** How Crewbook looks and the defaults it starts new work with. */
export function GeneralSettings() {
  const { isDark, setDark } = useDarkMode();
  const { settings, saveSetting } = useSettings();

  return (
    <section className="settings-section" aria-labelledby="settings-general-heading">
      <h2 id="settings-general-heading" className="settings-section__title">
        General
      </h2>
      <SettingsSwitchRow
        label="Dark mode"
        description="Uses a darker palette. Applies to this browser, including the lock screen."
        checked={isDark}
        onChange={setDark}
      />
      <SettingsSelectRow
        label="Default 1:1 cadence"
        description="What a new schedule starts with. You can still pick any cadence per person."
        value={settings.defaultCadence}
        options={CADENCE_CHOICES}
        onChange={(value) => saveSetting('defaultCadence', value as CadenceOption)}
      />
      <SettingsSelectRow
        label="Date format"
        description="The order dates are shown in, such as start dates and key dates."
        value={settings.dateFormat}
        options={DATE_FORMAT_CHOICES}
        onChange={(value) => saveSetting('dateFormat', value as DateFormat)}
      />
      <SettingsSelectRow
        label="First day of week"
        description="Which day each week starts on in the calendar."
        value={settings.firstDayOfWeek}
        options={FIRST_DAY_CHOICES}
        onChange={(value) => saveSetting('firstDayOfWeek', value as FirstDayOfWeek)}
      />
      <SettingsSwitchRow
        label="Live mode keyboard shortcuts"
        description="Single-key shortcuts while you run a 1:1 in live mode."
        checked={settings.liveShortcutsEnabled}
        onChange={(next) => saveSetting('liveShortcutsEnabled', next)}
      />
    </section>
  );
}
