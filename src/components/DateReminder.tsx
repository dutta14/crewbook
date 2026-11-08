import { useId, useState, type CSSProperties } from 'react';
import type { DateEventType, DateReminderData } from '../types/dateEvent';
import type { TeamMember } from '../types/TeamMember';
import {
  DATE_EVENT_LABELS,
  describeDaysUntil,
  firstName,
  isSensitiveDateEvent,
} from '../utils/dateEventFormat';
import { formatStartDate } from '../utils/startDate';
import '../styles/button.css';
import '../styles/reminder.css';
import '../styles/key-dates.css';
import { Avatar } from './Avatar';
import { CakeIcon, ClipboardIcon, PassportIcon, StarIcon } from './icons';

export interface DateReminderProps {
  reminder: DateReminderData;
  /** The person on the team, so their avatar is current. */
  person?: TeamMember;
  /** Position in the stack, which staggers the entrance. */
  index?: number;
}

const ICONS: Record<DateEventType, typeof StarIcon> = {
  visa_expiry: PassportIcon,
  probation_end: ClipboardIcon,
  anniversary: StarIcon,
  birthday: CakeIcon,
};

/**
 * Visa and probation reminders say only that a date is near; the date and its kind stay behind a
 * button, so the card is safe to leave on screen. Birthdays and anniversaries read in full.
 */
function describe(reminder: DateReminderData): { text: string; timing: string | null } {
  const { type, engineerName, daysUntil, eventDate, tenureYears } = reminder;
  if (isSensitiveDateEvent(type)) {
    return {
      text: `Important date for ${firstName(engineerName)} ${describeDaysUntil(daysUntil)}`,
      timing: null,
    };
  }
  const text =
    type === 'anniversary'
      ? `${engineerName} \u00b7 ${tenureYears}-year work anniversary`
      : `Birthday: ${engineerName}`;
  const date = formatStartDate(eventDate);
  return { text, timing: daysUntil === 0 || !date ? 'Today' : `On ${date}` };
}

/** A card for a date-triggered reminder, in the same style as the contextual reminder cards. */
export function DateReminder({ reminder, person, index = 0 }: DateReminderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();
  const { type, engineerName, eventDate, conversationStarter } = reminder;
  const Icon = ICONS[type];
  const { text, timing } = describe(reminder);
  const isSensitive = isSensitiveDateEvent(type);
  const date = formatStartDate(eventDate);

  return (
    <div
      className="reminder-card date-reminder-card"
      role="status"
      data-event-type={type}
      style={{ '--card-index': index } as CSSProperties}
    >
      <div className="reminder-card__body">
        <span className="reminder-card__bell" data-icon={type}>
          <Icon size={16} />
        </span>
        <div className="reminder-card__content">
          <p className="reminder-card__text">{text}</p>
          {timing ? <p className="reminder-card__timing">{timing}</p> : null}
          {conversationStarter ? (
            <p className="date-reminder__starter">{conversationStarter}</p>
          ) : null}
          {isSensitive ? (
            <>
              <button
                type="button"
                className="btn btn-ghost date-reminder__toggle"
                aria-expanded={isExpanded}
                aria-controls={isExpanded ? detailsId : undefined}
                aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${firstName(engineerName)}'s important date`}
                onClick={() => setIsExpanded((current) => !current)}
              >
                {isExpanded ? 'Hide details' : 'Show details'}
              </button>
              {isExpanded ? (
                <p id={detailsId} className="reminder-card__timing">
                  {DATE_EVENT_LABELS[type]}: {date ?? eventDate}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
        <Avatar name={engineerName} avatarUrl={person?.avatarUrl} size="sm" />
      </div>
    </div>
  );
}
