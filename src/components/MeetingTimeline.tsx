import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MeetingTimelineEntry } from '../types/meeting';
import { formatNoteDate } from '../utils/noteFormat';
import '../styles/meeting-stats.css';

interface MeetingTimelineProps {
  memberId: string;
  /** Newest first. */
  entries: MeetingTimelineEntry[];
}

export const TIMELINE_VISIBLE_ENTRIES = 10;

/** Past 1:1s, newest first. Each links to its note. Expanding reuses the entries already in memory. */
export function MeetingTimeline({ memberId, entries }: MeetingTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const firstRevealed = useRef<HTMLAnchorElement | null>(null);

  if (entries.length === 0) return <p className="meeting-timeline__empty">No meetings yet</p>;

  const visible = showAll ? entries : entries.slice(0, TIMELINE_VISIBLE_ENTRIES);
  const hiddenCount = entries.length - visible.length;

  const handleShowAll = () => {
    setShowAll(true);
    // The button disappears, so focus moves to the first entry it revealed.
    requestAnimationFrame(() => firstRevealed.current?.focus());
  };

  return (
    <div className="meeting-timeline">
      <ol className="meeting-timeline__list" aria-label="Meeting history">
        {visible.map((entry, index) => (
          <li key={entry.id} className="meeting-timeline__item">
            <span className="meeting-timeline__dot" aria-hidden="true" />
            <span className="meeting-timeline__line" aria-hidden="true" />
            <Link
              ref={index === TIMELINE_VISIBLE_ENTRIES ? firstRevealed : undefined}
              className="timeline-entry"
              to={`/person/${memberId}?note=${entry.id}`}
            >
              <time className="timeline-entry__date" dateTime={entry.date}>
                {formatNoteDate(entry.date)}
              </time>
              <span className="timeline-entry__preview">{entry.notePreview}</span>
            </Link>
          </li>
        ))}
      </ol>
      {hiddenCount > 0 ? (
        <button type="button" className="meeting-timeline__more" onClick={handleShowAll}>
          Show all {entries.length} meetings
        </button>
      ) : null}
    </div>
  );
}
