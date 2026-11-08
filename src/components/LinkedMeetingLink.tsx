import { Link } from 'react-router-dom';
import { formatLongDate, formatShortDate } from '../utils/decisionFormat';

interface LinkedMeetingLinkProps {
  engineerId: string;
  meetingId: string;
  /** YYYY-MM-DD */
  meetingDate: string;
  /** False when the note is gone or the 1:1 has not been saved yet. */
  isAvailable?: boolean;
}

/**
 * Opens the profile on the note that records the 1:1. The note id travels in router state, so
 * it never shows up in the address bar or the browser history entry's URL.
 */
export function LinkedMeetingLink({
  engineerId,
  meetingId,
  meetingDate,
  isAvailable = true,
}: LinkedMeetingLinkProps) {
  const shortDate = formatShortDate(meetingDate);
  const longDate = formatLongDate(meetingDate);
  if (!isAvailable || meetingId === '' || !shortDate || !longDate) {
    return <span className="decision-card__unavailable">Meeting note unavailable</span>;
  }
  return (
    <Link
      className="decision-card__meeting"
      to={`/person/${engineerId}`}
      state={{ noteId: meetingId }}
      aria-label={`View 1:1 notes from ${longDate}`}
    >
      From 1:1 on {shortDate}
    </Link>
  );
}
