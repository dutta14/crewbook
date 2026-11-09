import { useId, useState } from 'react';
import { getPrivateAutoLockMinutes } from '../data/settings';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { usePrivateViewGuard } from '../hooks/usePrivateViewGuard';
import type { TeamMember } from '../types/TeamMember';
import '../styles/flight-risk.css';
import { ChevronDownIcon, LockIcon } from './icons';
import { PrivateNotesPanel } from './PrivateNotesPanel';

interface PrivateNotesProps {
  member: Pick<TeamMember, 'id' | 'name'>;
  /** Idle time before the section closes itself. Defaults to the auto-lock setting in Settings. */
  idleMs?: number;
}

/**
 * Collapsed by default so a screen share or a glance over the shoulder shows nothing. Not for
 * shared or exported views: keep this and privateStore out of anything built from a share payload.
 */
export function PrivateNotes({ member, idleMs }: PrivateNotesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelId = useId();
  const storage = useEncryptedStorage();
  const minutes = getPrivateAutoLockMinutes(storage);
  // 0 is "Never": no idle timer, but hiding the tab still closes the section.
  const configuredIdleMs = minutes === 0 ? null : minutes * 60 * 1000;

  usePrivateViewGuard(isExpanded, () => setIsExpanded(false), idleMs ?? configuredIdleMs);

  return (
    <section className="private-notes" aria-label={`Private notes for ${member.name}`}>
      <h3 className="private-notes__heading">
        <button
          type="button"
          className="private-notes__toggle"
          aria-expanded={isExpanded}
          aria-controls={panelId}
          onClick={() => setIsExpanded((value) => !value)}
        >
          <LockIcon size={16} />
          <span className="private-notes__title">Private Notes (visible only to you)</span>
          <span className="private-notes__chevron" aria-hidden="true">
            <ChevronDownIcon size={16} />
          </span>
        </button>
      </h3>
      <div id={panelId} hidden={!isExpanded}>
        {isExpanded ? <PrivateNotesPanel engineerId={member.id} /> : null}
      </div>
    </section>
  );
}
