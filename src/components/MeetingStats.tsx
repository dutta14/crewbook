import type { MeetingStats as MeetingStatsData } from '../types/meeting';
import { formatCount } from '../utils/noteFormat';
import { formatAvgFrequency } from '../utils/meetingStats';
import '../styles/meeting-stats.css';

interface MeetingStatsProps {
  stats: MeetingStatsData;
}

/** A description list, so each figure is announced together with its label. */
export function MeetingStats({ stats }: MeetingStatsProps) {
  const cells = [
    ['Total meetings', formatCount(stats.totalMeetings)],
    ['Last 30 days', formatCount(stats.last30Days)],
    ['Last 90 days', formatCount(stats.last90Days)],
    ['Avg frequency', formatAvgFrequency(stats.avgFrequencyDays)],
  ] as const;
  return (
    <dl className="meeting-stats">
      {cells.map(([label, value]) => (
        <div key={label} className="meeting-stats__cell">
          <dt className="meeting-stats__label">{label}</dt>
          <dd className="meeting-stats__value">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
