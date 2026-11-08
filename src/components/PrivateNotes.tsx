import { useId, useState } from 'react';
import { usePrivateViewGuard } from '../hooks/usePrivateViewGuard';
import type { TeamMember } from '../types/TeamMember';
import '../styles/flight-risk.css';
import { ChevronDownIcon, LockIcon } from './icons';
import { PrivateNotesPanel } from './PrivateNotesPanel';

interface PrivateNotesProps {
  member: Pick<TeamMember, 'id' | 'name'>;
  /** Idle time before the section closes itself. Defaults to five minutes. */
  idleMs?: number;
}

/**
 * Collapsed by default so a screen share or a glance over the shoulder shows nothing. Not for
 * shared or exported views: keep this and privateStore out of anything built from a share payload.
 */
export function PrivateNotes({ member, idleMs }: PrivateNotesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelId = useId();

  usePrivateViewGuard(isExpanded, () => setIsExpanded(false), idleMs);

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
