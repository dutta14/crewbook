import { useId } from 'react';
import { isMoodTrackingEnabled, setMoodTrackingEnabled } from '../data/settings';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useToast } from '../hooks/useToast';
import '../styles/settings.css';

const SAVE_FAILED = "Couldn't save that setting. Try again.";

export function Settings() {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const switchId = useId();
  const descriptionId = `${switchId}-description`;
  const isEnabled = isMoodTrackingEnabled(storage);

  const handleChange = async (next: boolean) => {
    try {
      await setMoodTrackingEnabled(next, storage);
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
        <div className="settings-row">
          <div className="settings-row__text">
            <label className="settings-row__label" htmlFor={switchId}>
              Track energy/mood after 1:1s
            </label>
            <p id={descriptionId} className="settings-row__description">
              Only visible to you. Never shared.
            </p>
          </div>
          <span className="switch">
            <input
              id={switchId}
              className="switch__input"
              type="checkbox"
              role="switch"
              checked={isEnabled}
              aria-describedby={descriptionId}
              onChange={(event) => void handleChange(event.target.checked)}
            />
            <span className="switch__track" aria-hidden="true">
              <span className="switch__knob" />
            </span>
          </span>
        </div>
      </section>
    </>
  );
}
