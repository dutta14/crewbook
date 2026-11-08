import { useReminders } from '../hooks/useReminders';
import '../styles/reminder.css';
import { ReminderStack } from './ReminderStack';

interface DashboardRemindersProps {
  /** Fixed clock for tests; defaults to the current time. */
  now?: Date;
}

const HEADING_ID = 'dashboard-reminders-heading';

/** Reminders set for a date that has arrived. Renders nothing when there are none. */
export function DashboardReminders({ now }: DashboardRemindersProps) {
  const { due, dismissReminder, snoozeReminder } = useReminders({ context: 'dashboard', now });

  if (due.length === 0) return null;

  return (
    <section className="reminders-card" aria-labelledby={HEADING_ID}>
      <h3 id={HEADING_ID} className="reminders-card__heading">
        Reminders
      </h3>
      <ReminderStack
        reminders={due}
        onDismiss={dismissReminder}
        onSnooze={snoozeReminder}
        announce
        now={now}
      />
    </section>
  );
}
