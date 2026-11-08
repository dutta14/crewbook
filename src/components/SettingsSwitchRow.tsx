import { useId } from 'react';
import '../styles/settings.css';

interface SettingsSwitchRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

export function SettingsSwitchRow({
  label,
  description,
  checked,
  onChange,
}: SettingsSwitchRowProps) {
  const switchId = useId();
  const descriptionId = `${switchId}-description`;

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
      <span className="switch">
        <input
          id={switchId}
          className="switch__input"
          type="checkbox"
          role="switch"
          checked={checked}
          aria-describedby={descriptionId}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="switch__track" aria-hidden="true">
          <span className="switch__knob" />
        </span>
      </span>
    </div>
  );
}
