import { isOverdue, parseIsoDate } from '../utils/scheduleCalculator';
import { formatScheduleDate } from '../utils/scheduleFormat';
import '../styles/schedule-card.css';
import { WarningIcon } from './icons';

interface NextOneOnOneProps {
  nextDate: string;
  now?: Date;
}

/** The next 1:1 date. Past dates turn red and say "Overdue", so colour is never the only signal. */
export function NextOneOnOne({ nextDate, now }: NextOneOnOneProps) {
  const label = formatScheduleDate(nextDate);
  if (!label || !parseIsoDate(nextDate)) return null;
  const overdue = isOverdue(nextDate, now);
  return (
    <span className={overdue ? 'next-one-on-one next-one-on-one--overdue' : 'next-one-on-one'}>
      {overdue ? <WarningIcon size={16} /> : null}
      <time key={nextDate} className="next-one-on-one__date" dateTime={nextDate}>
        {label}
      </time>
      {overdue ? <span className="next-one-on-one__badge">Overdue</span> : null}
    </span>
  );
}
