import { Link } from 'react-router-dom';
import type { TeamMember } from '../types/TeamMember';
import '../styles/table.css';
import { Avatar } from './Avatar';
import { NewHireCountdown } from './NewHireCountdown';
import { NextOneOnOne } from './NextOneOnOne';
import { StatusBadge, toBadgeStatus } from './StatusBadge';

interface RosterTableProps {
  members: TeamMember[];
}

export function RosterTable({ members }: RosterTableProps) {
  return (
    <table className="roster-table">
      <caption className="sr-only">Team members</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Level</th>
          <th scope="col">Status</th>
          <th scope="col">Next 1:1</th>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <tr key={member.id} className="roster-row" data-testid="member-row">
            <td>
              <div className="roster-identity">
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
              </div>
            </td>
            <td>
              <span className="level-tag">{member.level}</span>
            </td>
            <td>
              <StatusBadge status={toBadgeStatus(member.status)} />
            </td>
            <td>
              {member.schedule ? (
                <NextOneOnOne nextDate={member.schedule.nextDate} />
              ) : (
                <span className="roster-role">
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">No 1:1 scheduled</span>
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
