import { useMemo } from 'react';
import { listMembers } from '../data/members';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import type { Reminder, SnoozeOption } from '../types/reminder';
import '../styles/reminder.css';
import { ReminderCard } from './ReminderCard';

interface ReminderStackProps {
  reminders: Reminder[];
  onDismiss: (id: string) => Promise<void>;
  onSnooze: (id: string, option: SnoozeOption) => Promise<void>;
  isPast?: boolean;
  announce?: boolean;
  now?: Date;
}

/** A list of reminder cards. Each person is looked up on the team so their avatar is current. */
export function ReminderStack({
  reminders,
  onDismiss,
  onSnooze,
  isPast,
  announce,
  now,
}: ReminderStackProps) {
  const storage = useEncryptedStorage();
  const members = useMemo(() => listMembers(storage), [storage]);

  return (
    <ul className="reminder-stack">
      {reminders.map((reminder) => (
        <li key={reminder.id}>
          <ReminderCard
            reminder={reminder}
            person={members.find((member) => member.id === reminder.linkedPersonId)}
            onDismiss={onDismiss}
            onSnooze={onSnooze}
            isPast={isPast}
            announce={announce}
            now={now}
          />
        </li>
      ))}
    </ul>
  );
}
