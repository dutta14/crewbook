import { Link } from 'react-router-dom';
import type { Decision } from '../types/decisions';
import { formatShortDate } from '../utils/decisionFormat';
import '../styles/decisions.css';
import { GavelIcon } from './icons';
import { LinkedMeetingLink } from './LinkedMeetingLink';

interface DecisionCardProps {
  decision: Decision;
  /** Shown above the title on pages that list more than one person. */
  personName?: string;
  /** False when the note that records the 1:1 no longer exists. */
  isMeetingAvailable?: boolean;
}

export function DecisionCard({
  decision,
  personName,
  isMeetingAvailable = true,
}: DecisionCardProps) {
  const { title, context, date } = decision;
  return (
    <article className="decision-card decision-card--entering" aria-label={`Decision: ${title}`}>
      <div className="decision-card__head">
        <p className="decision-card__type">
          <GavelIcon size={16} />
          Decision
        </p>
        {personName ? (
          <Link className="decision-card__person" to={`/person/${decision.engineerId}`}>
            {personName}
          </Link>
        ) : null}
      </div>
      <p className="decision-card__title">{title}</p>
      {context ? <p className="decision-card__context">{context}</p> : null}
      <div className="decision-card__footer">
        <time className="decision-card__date" dateTime={date}>
          {formatShortDate(date) ?? date}
        </time>
        <LinkedMeetingLink
          engineerId={decision.engineerId}
          meetingId={decision.linkedMeetingId}
          meetingDate={decision.linkedMeetingDate}
          isAvailable={isMeetingAvailable}
        />
      </div>
    </article>
  );
}
