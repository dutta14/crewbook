import { Link } from 'react-router-dom';
import type { BriefingMeeting } from '../types/briefing';
import type { TeamMember } from '../types/TeamMember';
import { formatLastMet, formatTime } from '../utils/scheduleFormat';
import '../styles/todays-one-ones.css';
import { Avatar } from './Avatar';
import { BriefingSection } from './BriefingSection';

interface TodaysOneOnesProps {
  meetings: BriefingMeeting[];
  /** Used for avatar images only. */
  members: TeamMember[];
  index?: number;
}

/** Names, times and counts are derived on render and never stored, titled or put in the URL. */
export function TodaysOneOnes({ meetings, members, index }: TodaysOneOnesProps) {
  return (
    <BriefingSection
      id="todays-one-ones"
      title="Today's 1:1s"
      count={meetings.length}
      index={index}
    >
      {meetings.length === 0 ? (
        <div className="todays-card__empty">
          <p>No 1:1s scheduled today</p>
        </div>
      ) : (
        <ul className="todays-card__list">
          {meetings.map((meeting, position) => (
            <DigestRow
              key={meeting.engineerId}
              entry={meeting}
              member={members.find((member) => member.id === meeting.engineerId)}
              index={position}
            />
          ))}
        </ul>
      )}
    </BriefingSection>
  );
}

interface DigestRowProps {
  entry: BriefingMeeting;
  member: TeamMember | undefined;
  index: number;
}

const MAX_STAGGERED_ROWS = 10;

function DigestRow({ entry, member, index }: DigestRowProps) {
  const lastMet = entry.lastMetDate ? formatLastMet(entry.lastMetDate) : null;
  const count = entry.openActionItems;
  return (
    <li
      className="digest-item"
      style={{ animationDelay: `${Math.min(index, MAX_STAGGERED_ROWS) * 40}ms` }}
    >
      <Link
        className="digest-row"
        to={`/person/${entry.engineerId}`}
        aria-label={`1:1 with ${entry.name} at ${formatTime(entry.time)}`}
      >
        <span className="digest-row__who">
          <Avatar name={entry.name} avatarUrl={member?.avatarUrl} size="sm" aria-hidden />
          <span className="digest-row__name">{entry.name}</span>
          <span className="digest-row__time">{formatTime(entry.time)}</span>
        </span>
        <span className="digest-row__meta">
          {count > 0 ? (
            <span
              className="digest-row__pill"
              role="img"
              aria-label={`${count} open action ${count === 1 ? 'item' : 'items'}`}
            >
              {count}
            </span>
          ) : null}
          <span className="digest-row__last-met">
            {lastMet ? (
              <>
                Last met <time dateTime={lastMet.dateTime}>{lastMet.label}</time>
              </>
            ) : (
              'Not met yet'
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
