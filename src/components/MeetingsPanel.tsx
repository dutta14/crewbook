import { useId } from 'react';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useMeetingStats } from '../hooks/useMeetingStats';
import '../styles/meeting-stats.css';
import { FrequencyChart } from './FrequencyChart';
import { MeetingStats } from './MeetingStats';
import { MeetingTimeline } from './MeetingTimeline';

interface MeetingsPanelProps {
  memberId: string;
}

/** How often you meet one person: counts, a 12 week chart and the list of past 1:1s. */
export function MeetingsPanel({ memberId }: MeetingsPanelProps) {
  const prefix = useId();
  const { isPrivateUnlocked } = useEncryptedStorage();
  const { stats, timeline, frequency } = useMeetingStats(memberId);

  if (!isPrivateUnlocked)
    return <p className="meeting-timeline__empty">Opening your 1:1 history…</p>;

  return (
    <div className="meetings-panel">
      <section className="meeting-card" aria-label="Meeting stats">
        <MeetingStats stats={stats} />
      </section>
      <section className="meeting-card" aria-labelledby={`${prefix}-frequency`}>
        <h3 id={`${prefix}-frequency`} className="meeting-card__heading">
          Meeting frequency
        </h3>
        <FrequencyChart weeks={frequency} />
      </section>
      <section className="meeting-card" aria-labelledby={`${prefix}-history`}>
        <h3 id={`${prefix}-history`} className="meeting-card__heading">
          Meeting history
        </h3>
        <MeetingTimeline memberId={memberId} entries={timeline} />
      </section>
    </div>
  );
}
