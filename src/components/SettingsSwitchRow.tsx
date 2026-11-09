import { useId } from 'react';
import { useSavedFlash } from '../hooks/useSavedFlash';
import '../styles/settings.css';

interface SettingsSwitchRowProps {
  label: string;
  description: string;
  checked: boolean;
  /** May return a promise; "Saved" shows once it resolves and stays hidden if it rejects. */
  onChange: (next: boolean) => void | Promise<void>;
}

export function SettingsSwitchRow({
  label,
  description,
  checked,
  onChange,
}: SettingsSwitchRowProps) {
  const switchId = useId();
  const descriptionId = `${switchId}-description`;
  const { isSaved, flash } = useSavedFlash();

  const handleChange = async (next: boolean) => {
    try {
      await onChange(next);
    } catch {
      return;
    }
    flash();
  };

  return (
    <div className="settings-row">
      <div className="settings-row__text">
        <label className="settings-row__label" htmlFor={switchId}>
          {label}
        </label>
        <p id={descriptionId} className="settings-row__description">
          {description}
        </p>
      </div>
      <div className="settings-row__control">
        <span className="settings-saved" role="status" data-visible={isSaved}>
          {isSaved ? 'Saved' : ''}
        </span>
        <span className="switch">
          <input
            id={switchId}
            className="switch__input"
            type="checkbox"
            role="switch"
            checked={checked}
            aria-describedby={descriptionId}
            onChange={(event) => void handleChange(event.target.checked)}
          />
          <span className="switch__track" aria-hidden="true">
            <span className="switch__knob" />
          </span>
        </span>
      </div>
    </div>
  );
}
