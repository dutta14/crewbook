import { useEffect, useId, useMemo, useState } from 'react';
import { listMoodEntries } from '../data/moodEntries';
import { isMoodTrackingEnabled } from '../data/settings';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import '../styles/button.css';
import '../styles/mood.css';
import { LockIcon } from './icons';
import { MoodTrendChart } from './MoodTrendChart';

interface MoodTrendSectionProps {
  memberId: string;
}

const LOAD_FAILED = "Couldn't open your private notes. Lock and unlock Crewbook to try again.";

/**
 * Private energy trend for one person. Collapsed by default so ratings are not on screen during a
 * casual scroll or screen share. Renders nothing, not even hidden markup, when tracking is off.
 */
export function MoodTrendSection({ memberId }: MoodTrendSectionProps) {
  const storage = useEncryptedStorage();
  if (!isMoodTrackingEnabled(storage)) return null;
  return <MoodTrendCard memberId={memberId} />;
}

function MoodTrendCard({ memberId }: MoodTrendSectionProps) {
  const storage = useEncryptedStorage();
  const { isPrivateUnlocked, loadPrivate } = storage;
  const [isOpen, setIsOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const bodyId = useId();

  useEffect(() => {
    if (!isOpen) return;
    let isCurrent = true;
    loadPrivate().catch(() => {
      if (isCurrent) setLoadFailed(true);
    });
    return () => {
      isCurrent = false;
    };
  }, [isOpen, loadPrivate]);

  // Read only while expanded, so collapsed ratings are never decrypted into rendered state.
  const entries = useMemo(
    () => (isOpen && isPrivateUnlocked ? listMoodEntries(memberId, storage) : []),
    [isOpen, isPrivateUnlocked, memberId, storage],
  );

  return (
    <section className="mood-section" aria-labelledby={`${bodyId}-title`}>
      <div className="mood-section__header">
        <h3 id={`${bodyId}-title`} className="mood-section__title">
          <LockIcon size={14} />
          Energy trend (private)
        </h3>
        <button
          type="button"
          className="btn btn-secondary"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? 'Hide' : 'Show'}
        </button>
      </div>
      <div id={bodyId} className="mood-section__body">
        {!isOpen ? null : loadFailed ? (
          <p className="form-error" role="alert">
            {LOAD_FAILED}
          </p>
        ) : !isPrivateUnlocked ? (
          <p className="mood-chart__empty">Opening your private notes…</p>
        ) : (
          <MoodTrendChart entries={entries} />
        )}
      </div>
    </section>
  );
}
