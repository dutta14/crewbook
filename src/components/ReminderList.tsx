import { useReminders } from '../hooks/useReminders';
import type { TeamMember } from '../types/TeamMember';
import '../styles/form.css';
import '../styles/reminder.css';
import { ReminderStack } from './ReminderStack';

interface ReminderListProps {
  person: TeamMember;
  now?: Date;
}

const HEADING_ID = 'reminders-heading';
const PAST_HEADING_ID = 'past-reminders-heading';
const LOAD_FAILED = "Couldn't open your reminders. Lock and unlock Crewbook to try again.";

/** One person's reminders: what is still pending, then what has been dismissed. */
export function ReminderList({ person, now }: ReminderListProps) {
  const { isReady, loadFailed, active, past, dismissReminder, snoozeReminder } = useReminders({
    personId: person.id,
    now,
  });

  return (
    <section className="reminder-list" aria-labelledby={HEADING_ID}>
      <h3 id={HEADING_ID} className="reminder-list__heading">
        Reminders
      </h3>
      {loadFailed ? (
        <p className="form-error reminder-list__error" role="alert">
          {LOAD_FAILED}
        </p>
      ) : !isReady ? (
        <p className="reminder-list__empty">Opening your reminders…</p>
      ) : (
        <>
          {active.length === 0 ? (
            <p className="reminder-list__empty">
              Nothing to bring up yet. Add a reminder to raise it at the next 1:1.
            </p>
          ) : (
            <ReminderStack
              reminders={active}
              onDismiss={dismissReminder}
              onSnooze={snoozeReminder}
              now={now}
            />
          )}
          {past.length > 0 ? (
            <>
              <hr className="reminder-list__divider" />
              <section aria-labelledby={PAST_HEADING_ID}>
                <h3 id={PAST_HEADING_ID} className="reminder-list__heading">
                  Past reminders
                </h3>
                <ReminderStack
                  reminders={past}
                  onDismiss={dismissReminder}
                  onSnooze={snoozeReminder}
                  isPast
                  now={now}
                />
              </section>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
