import { Link } from 'react-router-dom';
import type { GapAlertData } from '../types/meeting';
import type { TeamMember } from '../types/TeamMember';
import '../styles/table.css';
import { GapAlert } from './GapAlert';
import { NewHireCountdown } from './NewHireCountdown';
import { NextOneOnOne } from './NextOneOnOne';
import { RosterAvatar } from './RosterAvatar';
import { StatusBadge, toBadgeStatus } from './StatusBadge';

interface RosterCardsProps {
  members: TeamMember[];
  /** Overdue 1:1s by member id. */
  gapAlerts?: ReadonlyMap<string, GapAlertData>;
}

export function RosterCards({ members, gapAlerts }: RosterCardsProps) {
  return (
    <ul className="roster-cards" aria-label="Team members">
      {members.map((member) => (
        <li
          key={member.id}
          className={`roster-card roster-row${member.schedule ? ' roster-card--scheduled' : ''}`}
          data-testid="member-row"
        >
          <RosterAvatar member={member} />
          <div className="roster-identity__text">
            <span className="roster-name">
              <Link className="roster-link" to={`/person/${member.id}`}>
                {member.name}
              </Link>
              <GapAlert alert={gapAlerts?.get(member.id)} />
            </span>
            <span className="roster-role">{member.role}</span>
            {member.status === 'new_hire' ? (
              <NewHireCountdown startDate={member.startDate} />
            ) : null}
          </div>
          <span className="roster-card__status">
            <StatusBadge status={toBadgeStatus(member.status)} />
          </span>
          <span className="level-tag roster-card__level">{member.level}</span>
          {member.schedule ? (
            <span className="roster-card__next">
              <span className="roster-role">Next 1:1: </span>
              <NextOneOnOne nextDate={member.schedule.nextDate} />
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
