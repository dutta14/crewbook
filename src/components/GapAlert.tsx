import { Link } from 'react-router-dom';
import type { GapAlertData } from '../types/meeting';
import type { TeamMember } from '../types/TeamMember';
import { formatGapDuration } from '../utils/meetingStats';
import '../styles/meeting-stats.css';
import '../styles/todays-one-ones.css';
import { Avatar } from './Avatar';
import { BriefingSection } from './BriefingSection';
import { ClockIcon } from './icons';

interface GapAlertProps {
  /** Nothing is shown without an alert, or when the 1:1s are on schedule. */
  alert?: GapAlertData;
}

/** Duration only, with no judgement. Names and ids are kept out of attributes and class names. */
export function GapAlert({ alert }: GapAlertProps) {
  if (!alert?.isOverdue) return null;
  const duration = formatGapDuration(alert.daysSinceLastMeeting);
  return (
    <span className="gap-badge" role="img" aria-label={`Overdue: last met ${duration} ago`}>
      <ClockIcon size={12} />
      <span aria-hidden="true">{duration}</span>
    </span>
  );
}

interface GapAlertCardProps {
  alerts: GapAlertData[];
  /** Used for avatar images only. */
  members: TeamMember[];
  index?: number;
}

const daysAgo = (days: number) => `${days} ${days === 1 ? 'day' : 'days'} ago`;

/** Everyone overdue for a 1:1, most overdue first. Read from memory on render and never stored. */
export function GapAlertCard({ alerts, members, index }: GapAlertCardProps) {
  return (
    <BriefingSection id="overdue-one-ones" title="Overdue 1:1s" count={alerts.length} index={index}>
      {alerts.length === 0 ? (
        <div className="todays-card__empty">
          <p>You&apos;re all caught up</p>
        </div>
      ) : (
        <ul className="todays-card__list">
          {alerts.map((alert) => (
            <li key={alert.engineerId} className="digest-item">
              <Link
                className="digest-row gap-alert-row"
                to={`/person/${alert.engineerId}`}
                aria-label={`Overdue 1:1 with ${alert.engineerName}, last met ${daysAgo(alert.daysSinceLastMeeting)}`}
              >
                <span className="digest-row__who">
                  <Avatar
                    name={alert.engineerName}
                    avatarUrl={members.find((member) => member.id === alert.engineerId)?.avatarUrl}
                    size="sm"
                    aria-hidden
                  />
                  <span className="digest-row__name">{alert.engineerName}</span>
                </span>
                <span className="digest-row__last-met">
                  Last met {daysAgo(alert.daysSinceLastMeeting)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BriefingSection>
  );
}
