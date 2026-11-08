import { daysUntilStart, toDateAttribute } from '../utils/startDate';

interface NewHireCountdownProps {
  startDate: string;
  now?: Date;
}

export function formatCountdown(days: number): string {
  if (days === 0) return 'Starts today';
  return `Starts in ${days} ${days === 1 ? 'day' : 'days'}`;
}

/** Renders nothing once the start date has passed. */
export function NewHireCountdown({ startDate, now }: NewHireCountdownProps) {
  const days = daysUntilStart(startDate, now);
  if (days < 0) return null;
  return (
    <time className="roster-countdown" dateTime={toDateAttribute(startDate)}>
      {formatCountdown(days)}
    </time>
  );
}
