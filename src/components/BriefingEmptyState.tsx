import '../styles/dashboard.css';
import { SunIcon } from './icons';

interface BriefingEmptyStateProps {
  /** "Your next 1:1 is with Dana on Thursday." */
  nextMeetingInfo?: string;
}

export function BriefingEmptyState({ nextMeetingInfo }: BriefingEmptyStateProps) {
  return (
    <div className="briefing-empty" role="status">
      <SunIcon size={48} />
      <p>{nextMeetingInfo ? `All clear today. ${nextMeetingInfo}` : 'All clear today.'}</p>
    </div>
  );
}
