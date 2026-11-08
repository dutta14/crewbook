import { Link } from 'react-router-dom';
import { LEAVE_TYPE_LABELS } from '../data/leave';
import type { BriefingWhosOut as WhosOutEntry } from '../types/briefing';
import type { TeamMember } from '../types/TeamMember';
import { formatDayRange } from '../utils/calendarDates';
import '../styles/todays-one-ones.css';
import { Avatar } from './Avatar';
import { BriefingSection } from './BriefingSection';
import { LeaveTypeBadge } from './LeaveTypeBadge';

interface BriefingWhosOutProps {
  people: WhosOutEntry[];
  /** Used for avatar images only. */
  members: TeamMember[];
  /** YYYY-MM-DD, used to decide whether a date needs its year. */
  today: string;
  index?: number;
}

/** Leave this week. Names, dates and types are derived on render and never stored or titled. */
export function BriefingWhosOut({ people, members, today, index }: BriefingWhosOutProps) {
  return (
    <BriefingSection id="whos-out" title="Who's Out This Week" count={people.length} index={index}>
      {people.length === 0 ? (
        <div className="todays-card__empty">
          <p>Nobody is out this week</p>
        </div>
      ) : (
        <ul className="todays-card__list">
          {people.map((person) => {
            const range = formatDayRange(person.startDate, person.endDate, { today });
            return (
              <li key={person.id} className="digest-item">
                <Link
                  className="digest-row"
                  to={`/person/${person.engineerId}`}
                  aria-label={`${person.name}, ${LEAVE_TYPE_LABELS[person.leaveKind]}, ${range}`}
                >
                  <span className="digest-row__who">
                    <Avatar
                      name={person.name}
                      avatarUrl={
                        members.find((member) => member.id === person.engineerId)?.avatarUrl
                      }
                      size="sm"
                      aria-hidden
                    />
                    <span className="digest-row__name">{person.name}</span>
                  </span>
                  <span className="digest-row__meta">
                    <span className="digest-row__time">{range}</span>
                    <LeaveTypeBadge type={person.leaveKind} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </BriefingSection>
  );
}
