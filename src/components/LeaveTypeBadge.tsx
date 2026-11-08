import { LEAVE_TYPE_LABELS } from '../data/leave';
import type { LeaveType } from '../types/leave';
import '../styles/calendar.css';

interface LeaveTypeBadgeProps {
  /** A leave type picks its colour pair; anything else (such as "Away") reads neutral. */
  type?: LeaveType;
  /** Defaults to the type's label. The text always says the type, so colour is never the only cue. */
  label?: string;
}

export function LeaveTypeBadge({ type, label }: LeaveTypeBadgeProps) {
  return (
    <span
      className={`leave-badge leave-badge--${type ?? 'away'}`}
      {...(type ? { 'data-leave-type': type } : {})}
    >
      {label ?? (type ? LEAVE_TYPE_LABELS[type] : 'Away')}
    </span>
  );
}
