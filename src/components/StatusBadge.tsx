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
