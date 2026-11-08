import { isApplePlatform } from '../hooks/useKeyboardShortcut';
import '../styles/pages/live-mode.css';

interface ShortcutSettingsProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

const SHORTCUTS = [
  { key: 'A', label: 'Add action item' },
  { key: 'D', label: 'Add decision' },
];

/** Hints for the live mode shortcuts, with a switch to turn them off if they clash. */
export function ShortcutSettings({ enabled, onChange }: ShortcutSettingsProps) {
  const modifier = isApplePlatform() ? '⌘' : 'Ctrl';
  return (
    <section className="context-sidebar__section" aria-label="Keyboard shortcuts">
      <h3 className="context-sidebar__title">Shortcuts</h3>
      {enabled ? (
        <ul className="context-sidebar__shortcuts">
          {SHORTCUTS.map(({ key, label }) => (
            <li key={key}>
              <span>
                <kbd>{modifier}</kbd> <kbd>Shift</kbd> <kbd>{key}</kbd>
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <label className="context-sidebar__check">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>Keyboard shortcuts</span>
      </label>
    </section>
  );
}
