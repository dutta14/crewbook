import { useState } from 'react';
import { Link } from 'react-router-dom';
import { isFollowUpOverdue } from '../data/decisions';
import type { FollowUp, FollowUpStatus } from '../types/decisions';
import { formatShortDate } from '../utils/decisionFormat';
import '../styles/decisions.css';
import { Avatar } from './Avatar';
import { ArrowRightIcon } from './icons';
import { LinkedMeetingLink } from './LinkedMeetingLink';

interface FollowUpCardProps {
  followUp: FollowUp;
  /** The owner's current name; falls back to the name stored with the follow-up. */
  ownerName?: string;
  ownerAvatarUrl?: string;
  /** Shown above the title on pages that list more than one person. */
  personName?: string;
  isMeetingAvailable?: boolean;
  /** Rejecting means the change did not happen; the caller is expected to report why. */
  onStatusChange: (id: string, next: FollowUpStatus) => Promise<void> | void;
  now?: Date;
}

const STATUS_LABELS: Record<FollowUpStatus, string> = { pending: 'Pending', done: 'Done' };

export function FollowUpCard({
  followUp,
  ownerName,
  ownerAvatarUrl,
  personName,
  isMeetingAvailable = true,
  onStatusChange,
  now,
}: FollowUpCardProps) {
  const [announcement, setAnnouncement] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  const { id, title, status, dueDate } = followUp;
  const owner = ownerName ?? followUp.ownerName;
  const dueLabel = dueDate ? formatShortDate(dueDate) : null;
  const overdue = isFollowUpOverdue(followUp, now);
  const next: FollowUpStatus = status === 'pending' ? 'done' : 'pending';

  const handleToggle = async () => {
    if (isChanging) return;
    setIsChanging(true);
    try {
      await onStatusChange(id, next);
      setAnnouncement(`Follow-up marked as ${next}`);
    } catch {
      // The caller has already told the person it failed; the badge keeps showing the old status.
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <article
      className="decision-card decision-card--follow-up decision-card--entering"
      aria-label={`Follow-up: ${title}`}
    >
      <div className="decision-card__head">
        <p className="decision-card__type">
          <ArrowRightIcon size={16} />
          Follow-up
        </p>
        {personName ? (
          <Link className="decision-card__person" to={`/person/${followUp.engineerId}`}>
            {personName}
          </Link>
        ) : null}
      </div>
      <div className="decision-card__row">
        <p className="decision-card__title">{title}</p>
        <span className="decision-card__owner">
          <span className="decision-card__owner-avatar">
            <Avatar name={owner} size="sm" avatarUrl={ownerAvatarUrl} aria-hidden />
          </span>
          {owner}
        </span>
      </div>
      <div className="decision-card__footer">
        <span className={`decision-card__due${overdue ? ' decision-card__due--overdue' : ''}`}>
          {dueDate && dueLabel ? (
            <>
              Due <time dateTime={dueDate}>{dueLabel}</time>
              {overdue ? <span className="sr-only"> (overdue)</span> : null}
            </>
          ) : (
            'No due date'
          )}
        </span>
        <LinkedMeetingLink
          engineerId={followUp.engineerId}
          meetingId={followUp.linkedMeetingId}
          meetingDate={followUp.linkedMeetingDate}
          isAvailable={isMeetingAvailable}
        />
        <button
          type="button"
          className="decision-card__toggle"
          aria-label={status === 'pending' ? 'Mark as done' : 'Mark as pending'}
          aria-disabled={isChanging}
          onClick={() => void handleToggle()}
        >
          <span className={`decision-card__status decision-card__status--${status}`}>
            {STATUS_LABELS[status]}
          </span>
        </button>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </article>
  );
}
