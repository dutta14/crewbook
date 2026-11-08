import type { TeamMemberStatus } from '../types/TeamMember';
import './StatusBadge.css';

export type StatusBadgeStatus = 'active' | 'on-leave' | 'departing' | 'new';

interface StatusBadgeProps {
  status: StatusBadgeStatus;
  size?: 'sm' | 'md';
}

const LABELS: Record<StatusBadgeStatus, string> = {
  active: 'Active',
  'on-leave': 'On leave',
  departing: 'Departing',
  new: 'New hire',
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${status} status-badge--${size}`}>
      {LABELS[status]}
    </span>
  );
}

const BADGE_STATUS: Record<TeamMemberStatus, StatusBadgeStatus> = {
  active: 'active',
  on_leave: 'on-leave',
  departing: 'departing',
  new_hire: 'new',
};

export function toBadgeStatus(status: TeamMemberStatus): StatusBadgeStatus {
  return BADGE_STATUS[status];
}
