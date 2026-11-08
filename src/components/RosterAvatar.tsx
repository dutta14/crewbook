import { useState } from 'react';
import { useRiskIndicatorLevel } from '../hooks/usePrivateNotes';
import type { TeamMember } from '../types/TeamMember';
import '../styles/flight-risk.css';
import { Avatar } from './Avatar';
import { FlightRiskIndicator } from './FlightRiskIndicator';

interface RosterAvatarProps {
  member: Pick<TeamMember, 'id' | 'name' | 'avatarUrl'>;
}

/** The roster avatar with the manager-only risk dot at its bottom-right corner. */
export function RosterAvatar({ member }: RosterAvatarProps) {
  const level = useRiskIndicatorLevel(member.id);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <span
      className="roster-avatar"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Avatar name={member.name} avatarUrl={member.avatarUrl} aria-hidden />
      <FlightRiskIndicator level={level} isLabelVisible={isHovered} />
    </span>
  );
}
