import { useId } from 'react';
import { useSavedFlash } from '../hooks/useSavedFlash';
import '../styles/form.css';
import '../styles/settings.css';

export interface SettingsSelectOption {
  value: string;
  label: string;
}

interface SettingsSelectRowProps {
  label: string;
  description: string;
  value: string;
  options: readonly SettingsSelectOption[];
  /** Resolves when saved. A rejection means the change did not stick and no "Saved" is shown. */
  onChange: (value: string) => void | Promise<void>;
}

/** A labelled select with a hint, and a brief "Saved" beside it once a change is stored. */
export function SettingsSelectRow({
  label,
  description,
  value,
  options,
  onChange,
}: SettingsSelectRowProps) {
  const selectId = useId();
  const descriptionId = `${selectId}-description`;
  const { isSaved, flash } = useSavedFlash();

  const handleChange = async (next: string) => {
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
        <label className="settings-row__label" htmlFor={selectId}>
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
        <select
          id={selectId}
          className="form-input settings-select"
          value={value}
          aria-describedby={descriptionId}
          onChange={(event) => void handleChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
