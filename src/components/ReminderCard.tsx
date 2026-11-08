import { useEffect, useRef, useState } from 'react';
import type { TeamMember } from '../types/TeamMember';
import type { Reminder, SnoozeOption } from '../types/reminder';
import { guardFocusLoss } from '../utils/focus';
import { describeReminderTiming, truncateReminderText } from '../utils/reminderFormat';
import '../styles/button.css';
import '../styles/reminder.css';
import { Avatar } from './Avatar';
import { BellIcon } from './icons';
import { SnoozeMenu } from './SnoozeMenu';

// Matches the collapse in reminder.css.
const DISMISS_DURATION_MS = 250;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface ReminderCardProps {
  reminder: Reminder;
  /** The linked person, when they are still on the team. */
  person?: TeamMember;
  /** Resolves once the change is saved; rejects when it is not, and the caller reports why. */
  onDismiss: (id: string) => Promise<void>;
  onSnooze: (id: string, option: SnoozeOption) => Promise<void>;
  /** Dismissed reminders are shown for reference, without actions. */
  isPast?: boolean;
  /** Announces the card to screen readers when it appears, for cards that surface unprompted. */
  announce?: boolean;
  now?: Date;
}

/**
 * Dismissal is only saved once the card has faded out; leaving the page first saves it at once.
 * A dismissed reminder is removed from the DOM, not hidden.
 */
export function ReminderCard({
  reminder,
  person,
  onDismiss,
  onSnooze,
  isPast = false,
  announce = false,
  now,
}: ReminderCardProps) {
  const [isDismissing, setIsDismissing] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      pending.current?.();
    },
    [],
  );

  const name = person?.name ?? reminder.linkedPersonName;
  const timing = describeReminderTiming(reminder, now);

  const save = async (keepFocus: () => void) => {
    pending.current = null;
    setIsBusy(true);
    try {
      await onDismiss(reminder.id);
      keepFocus();
    } catch {
      // The caller has already reported the failure; the card stays as it was.
      setIsDismissing(false);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDismiss = () => {
    if (isBusy || isDismissing) return;
    const keepFocus = guardFocusLoss(cardRef.current);
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      void save(keepFocus);
      return;
    }
    setIsDismissing(true);
    pending.current = () => void onDismiss(reminder.id).catch(() => undefined);
    timer.current = setTimeout(() => void save(keepFocus), DISMISS_DURATION_MS);
  };

  const handleSnooze = async (option: SnoozeOption) => {
    const keepFocus = guardFocusLoss(cardRef.current);
    setIsBusy(true);
    try {
      await onSnooze(reminder.id, option);
      keepFocus();
    } catch {
      // The caller has already reported the failure.
    } finally {
      setIsBusy(false);
    }
  };

  const classes = [
    'reminder-card',
    isPast ? 'reminder-card--past' : '',
    isDismissing ? 'reminder-card--dismissing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={cardRef} className={classes} role={announce ? 'status' : undefined}>
      <div className="reminder-card__body">
        <span className="reminder-card__bell">
          <BellIcon size={16} />
        </span>
        <div className="reminder-card__content">
          <p className="reminder-card__text">{reminder.text}</p>
          <p className="reminder-card__timing">{timing}</p>
        </div>
        <Avatar name={name} avatarUrl={person?.avatarUrl} size="sm" />
      </div>
      {isPast ? null : (
        <div className="reminder-card__actions">
          <button
            type="button"
            className="btn btn-ghost reminder-card__action"
            aria-label={`Dismiss reminder: ${truncateReminderText(reminder.text)}`}
            disabled={isBusy || isDismissing}
            onClick={handleDismiss}
          >
            Dismiss
          </button>
          <SnoozeMenu disabled={isBusy || isDismissing} onSelect={(o) => void handleSnooze(o)} />
        </div>
      )}
    </div>
  );
}
