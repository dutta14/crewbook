import { FEEDBACK_TYPE_LABELS } from '../data/feedbackStore';
import type { FeedbackEntry } from '../types/feedback';
import { formatLongDate, formatShortDate } from '../utils/decisionFormat';
import '../styles/button.css';
import '../styles/feedback.css';
import { Avatar } from './Avatar';
import { LockIcon, PencilIcon, TrashIcon } from './icons';

interface FeedbackEntryCardProps {
  entry: FeedbackEntry;
  personName: string;
  avatarUrl?: string;
  onEdit: (entry: FeedbackEntry) => void;
  onDelete: (entry: FeedbackEntry) => void;
}

/** One observation. The text is rendered as plain text, never as markup. */
export function FeedbackEntryCard({
  entry,
  personName,
  avatarUrl,
  onEdit,
  onDelete,
}: FeedbackEntryCardProps) {
  const typeLabel = FEEDBACK_TYPE_LABELS[entry.type];
  const longDate = formatLongDate(entry.date) ?? entry.date;
  const description = `${typeLabel.toLowerCase()} feedback for ${personName} from ${longDate}`;

  return (
    <li className={`feedback-card feedback-card--${entry.type}`}>
      <div className="feedback-card__top">
        <Avatar name={personName} size="sm" avatarUrl={avatarUrl} aria-hidden />
        <div className="feedback-card__who">
          <span className="feedback-card__name">{personName}</span>
          <time className="feedback-card__date" dateTime={entry.date}>
            {formatShortDate(entry.date) ?? entry.date}
          </time>
        </div>
        <span className={`feedback-badge feedback-badge--${entry.type}`}>{typeLabel}</span>
        <div className="feedback-card__actions">
          <button
            type="button"
            className="icon-btn"
            aria-label={`Edit ${description}`}
            onClick={() => onEdit(entry)}
          >
            <PencilIcon size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Delete ${description}`}
            onClick={() => onDelete(entry)}
          >
            <TrashIcon size={16} />
          </button>
        </div>
      </div>
      <p className="feedback-card__text">{entry.text}</p>
      {entry.tags.length > 0 ? (
        <ul className="feedback-card__tags" aria-label="Tags">
          {entry.tags.map((tag) => (
            <li key={tag} className="feedback-tag">
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
      {entry.type === 'constructive' ? (
        <p className="feedback-card__private">
          <LockIcon size={12} /> For your eyes only
        </p>
      ) : null}
    </li>
  );
}
