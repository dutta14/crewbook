import { Link } from 'react-router-dom';
import type { TeamMember } from '../types/TeamMember';
import '../styles/table.css';
import { Avatar } from './Avatar';
import { NewHireCountdown } from './NewHireCountdown';
import { NextOneOnOne } from './NextOneOnOne';
import { StatusBadge, toBadgeStatus } from './StatusBadge';

interface RosterCardsProps {
  members: TeamMember[];
}

export function RosterCards({ members }: RosterCardsProps) {
  return (
    <ul className="roster-cards" aria-label="Team members">
      {members.map((member) => (
        <li
          key={member.id}
          className={`roster-card roster-row${member.schedule ? ' roster-card--scheduled' : ''}`}
          data-testid="member-row"
        >
          <Avatar name={member.name} avatarUrl={member.avatarUrl} aria-hidden />
          <div className="roster-identity__text">
            <Link className="roster-link" to={`/person/${member.id}`}>
              {member.name}
            </Link>
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
