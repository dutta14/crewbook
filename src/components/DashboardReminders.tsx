import { useMemo } from 'react';
import { listMembers } from '../data/members';
import { useDateReminders } from '../hooks/useDateEvents';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useReminders } from '../hooks/useReminders';
import '../styles/reminder.css';
import { DateReminder } from './DateReminder';
import { ReminderStack } from './ReminderStack';

interface DashboardRemindersProps {
  /** Fixed clock for tests; defaults to the current time. */
  now?: Date;
}

const HEADING_ID = 'dashboard-reminders-heading';

/**
 * Reminders set for a date that has arrived, and those worked out from dates on a profile (visa,
 * probation, anniversary, birthday). Renders nothing when there are none.
 */
export function DashboardReminders({ now }: DashboardRemindersProps) {
  const { due, dismissReminder, snoozeReminder } = useReminders({ context: 'dashboard', now });
  const dateReminders = useDateReminders(now);
  const storage = useEncryptedStorage();
  const members = useMemo(() => listMembers(storage), [storage]);

  if (due.length === 0 && dateReminders.length === 0) return null;

  return (
    <section className="reminders-card" aria-labelledby={HEADING_ID}>
      <h3 id={HEADING_ID} className="reminders-card__heading">
        Reminders
      </h3>
      <div className="reminders-card__lists">
        {dateReminders.length > 0 ? (
          <ul className="reminder-stack">
            {dateReminders.map((reminder, index) => (
              <li key={`${reminder.engineerId}:${reminder.type}`}>
                <DateReminder
                  reminder={reminder}
                  person={members.find((member) => member.id === reminder.engineerId)}
                  index={index}
                />
              </li>
            ))}
          </ul>
        ) : null}
        {due.length > 0 ? (
          <ReminderStack
            reminders={due}
            onDismiss={dismissReminder}
            onSnooze={snoozeReminder}
            announce
            now={now}
          />
        ) : null}
      </div>
    </section>
  );
}
