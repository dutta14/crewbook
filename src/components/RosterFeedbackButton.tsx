import type { TeamMember } from '../types/TeamMember';
import '../styles/button.css';
import '../styles/table.css';
import { MessageSquareIcon } from './icons';

interface RosterFeedbackButtonProps {
  member: Pick<TeamMember, 'id' | 'name'>;
  onLogFeedback: (memberId: string) => void;
}

/** Quick-add for one person from their roster row. It sits above the row-wide profile link. */
export function RosterFeedbackButton({ member, onLogFeedback }: RosterFeedbackButtonProps) {
  return (
    <button
      type="button"
      className="icon-btn roster-feedback-btn"
      aria-label={`Log feedback for ${member.name}`}
      onClick={() => onLogFeedback(member.id)}
    >
      <MessageSquareIcon size={16} />
    </button>
  );
}
