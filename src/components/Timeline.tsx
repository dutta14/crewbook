import type { TimelineEntry } from '../types/Timeline';
import '../styles/timeline.css';

interface TimelineProps {
  entries: TimelineEntry[];
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function Timeline({ entries }: TimelineProps) {
  if (entries.length === 0) {
    return <p className="timeline-empty">No activity recorded yet</p>;
  }
  return (
    <ol className="timeline" aria-label="Activity timeline">
      {entries.map((entry) => (
        <li key={entry.id} className="timeline__entry">
          <time className="timeline__date" dateTime={entry.date}>
            {formatDate(entry.date)}
          </time>
          <span className="timeline__description">{entry.description}</span>
        </li>
      ))}
    </ol>
  );
}
