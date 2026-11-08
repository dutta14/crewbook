import { LEAVE_TYPE_LABELS } from '../data/leave';
import type { LeaveEntry } from '../types/leave';
import type { TeamMember } from '../types/TeamMember';
import { getInitials } from '../utils/avatarColor';
import { formatDayRange } from '../utils/calendarDates';
import '../styles/calendar.css';
import { Avatar } from './Avatar';

interface LeaveChipProps {
  entry: LeaveEntry;
  member: TeamMember;
  /** "chip" is the compact month entry; "bar" is the taller week entry with an avatar. */
  variant: 'chip' | 'bar';
  /** Only the chips in the focused day are in the tab order. */
  tabIndex: 0 | -1;
  onSelect: (entry: LeaveEntry) => void;
}

export function LeaveChip({ entry, member, variant, tabIndex, onSelect }: LeaveChipProps) {
  const typeLabel = LEAVE_TYPE_LABELS[entry.type];
  const range = formatDayRange(entry.startDate, entry.endDate, { withYear: true });

  return (
    <button
      type="button"
      className={`leave-chip leave-chip--${variant} leave-chip--${entry.type}`}
      data-leave-type={entry.type}
      aria-label={`${member.name}, ${typeLabel}, ${range}`}
      tabIndex={tabIndex}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(entry);
      }}
    >
      {variant === 'bar' ? (
        <Avatar name={member.name} avatarUrl={member.avatarUrl} size="sm" aria-hidden />
      ) : null}
      <span className="leave-chip__name" aria-hidden="true">
        {member.name}
      </span>
      <span className="leave-chip__initials" aria-hidden="true">
        {getInitials(member.name)}
      </span>
      <span className="leave-chip__type" aria-hidden="true">
        {typeLabel}
      </span>
    </button>
  );
}
