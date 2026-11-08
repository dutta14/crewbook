import { Link } from 'react-router-dom';
import type { BriefingLeave } from '../types/briefing';
import type { TeamMember } from '../types/TeamMember';
import '../styles/todays-one-ones.css';
import { Avatar } from './Avatar';
import { BriefingSection } from './BriefingSection';
import { LeaveTypeBadge } from './LeaveTypeBadge';

interface BriefingOnLeaveProps {
  people: BriefingLeave[];
  /** Used for avatar images only. */
  members: TeamMember[];
  index?: number;
}

/** Who is away today, with the kind of leave. It stays out of titles and the URL. */
export function BriefingOnLeave({ people, members, index }: BriefingOnLeaveProps) {
  return (
    <BriefingSection id="on-leave" title="On Leave" count={people.length} index={index}>
      {people.length === 0 ? (
        <div className="todays-card__empty">
          <p>Nobody is away today</p>
        </div>
      ) : (
        <ul className="todays-card__list">
          {people.map((person) => (
            <li key={person.engineerId} className="digest-item">
              <Link
                className="digest-row"
                to={`/person/${person.engineerId}`}
                aria-label={`${person.name}, ${person.leaveType}`}
              >
                <span className="digest-row__who">
                  <Avatar
                    name={person.name}
                    avatarUrl={members.find((member) => member.id === person.engineerId)?.avatarUrl}
                    size="sm"
                    aria-hidden
                  />
                  <span className="digest-row__name">{person.name}</span>
                </span>
                <LeaveTypeBadge type={person.leaveKind} label={person.leaveType} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BriefingSection>
  );
}
