import type { DateReminderData } from '../types/dateEvent';
import type { Reminder, SnoozeOption } from '../types/reminder';
import type { TeamMember } from '../types/TeamMember';
import '../styles/reminder.css';
import { BriefingSection } from './BriefingSection';
import { DateReminder } from './DateReminder';
import { ReminderStack } from './ReminderStack';

interface DashboardRemindersProps {
  /** Reminders whose date has arrived. */
  reminders: Reminder[];
  /** Visa and probation dates worked out from a profile. */
  importantDates: DateReminderData[];
  members: TeamMember[];
  onDismiss: (id: string) => Promise<void>;
  onSnooze: (id: string, option: SnoozeOption) => Promise<void>;
  index?: number;
  /** Fixed clock for tests; defaults to the current time. */
  now?: Date;
}

/** Reminders set for a date that has arrived, and those worked out from dates on a profile. */
export function DashboardReminders({
  reminders,
  importantDates,
  members,
  onDismiss,
  onSnooze,
  index,
  now,
}: DashboardRemindersProps) {
  const count = reminders.length + importantDates.length;

  return (
    <BriefingSection id="reminders" title="Reminders" count={count} index={index}>
      {count === 0 ? (
        <div className="todays-card__empty">
          <p>No reminders today</p>
        </div>
      ) : (
        <div className="reminders-card__lists">
          {importantDates.length > 0 ? (
            <ul className="reminder-stack">
              {importantDates.map((reminder, position) => (
                <li key={`${reminder.engineerId}:${reminder.type}`}>
                  <DateReminder
                    reminder={reminder}
                    person={members.find((member) => member.id === reminder.engineerId)}
                    index={position}
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {reminders.length > 0 ? (
            <ReminderStack
              reminders={reminders}
              onDismiss={onDismiss}
              onSnooze={onSnooze}
              announce
              now={now}
            />
          ) : null}
        </div>
      )}
    </BriefingSection>
  );
}
