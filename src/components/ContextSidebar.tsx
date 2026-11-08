import { useId, useState, type ReactNode } from 'react';
import { listByMember, updateStatus } from '../data/actionItems';
import { listNotes } from '../data/notes';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useReminders } from '../hooks/useReminders';
import { useToast } from '../hooks/useToast';
import type { ActionItem } from '../types/ActionItem';
import type { Note } from '../types/Note';
import { formatNoteDate } from '../utils/noteFormat';
import '../styles/pages/live-mode.css';
import { PrepPrompts } from './PrepPrompts';
import { ReminderStack } from './ReminderStack';

export const LAST_NOTES_PREVIEW_LENGTH = 200;

interface ContextSidebarProps {
  id: string;
  memberId: string;
  /** Below 768px the sidebar is a drawer; `isOpen` says whether it is showing. */
  isOpen: boolean;
  /** A closed drawer is taken out of the tab order and the accessibility tree. */
  isInert: boolean;
  footer?: ReactNode;
}

const UPDATE_FAILED = "Couldn't update that action item. Try again.";

/** Fixed prompts, plus a nudge for each kind of context that is on screen. Nothing is fetched. */
export function buildPrepPrompts(openCount: number, hasLastNotes: boolean): string[] {
  const prompts: string[] = [];
  if (openCount > 0) prompts.push('Check in on the open action items.');
  if (hasLastNotes) prompts.push('Ask how last time’s topics have moved since.');
  prompts.push(
    'What is going well, and what is getting in the way?',
    'Is there anything they need from you this week?',
    'How are they feeling about their growth?',
  );
  return prompts;
}

function truncate(text: string): string {
  return text.length > LAST_NOTES_PREVIEW_LENGTH
    ? `${text.slice(0, LAST_NOTES_PREVIEW_LENGTH).trimEnd()}…`
    : text;
}

/** Read once when live mode opens, so it does not change under the manager mid-conversation. */
export function ContextSidebar({ id, memberId, isOpen, isInert, footer }: ContextSidebarProps) {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const { due, dismissReminder, snoozeReminder } = useReminders({
    personId: memberId,
    context: '1on1_prep',
  });
  const ids = useId();
  const [openItems] = useState<ActionItem[]>(() => listByMember(memberId, storage, 'open'));
  const [lastNote] = useState<Note | null>(() => listNotes(memberId, storage)[0] ?? null);
  const [doneIds, setDoneIds] = useState<ReadonlySet<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompts] = useState(() => buildPrepPrompts(openItems.length, lastNote !== null));

  const toggle = (item: ActionItem, isDone: boolean) => {
    setDoneIds((current) => {
      const next = new Set(current);
      if (isDone) next.add(item.id);
      else next.delete(item.id);
      return next;
    });
    updateStatus(item.id, isDone ? 'done' : 'open', storage).catch(() => {
      setDoneIds((current) => {
        const next = new Set(current);
        if (isDone) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
      showToast(UPDATE_FAILED, 'error');
    });
  };

  const canExpand = lastNote !== null && lastNote.content.length > LAST_NOTES_PREVIEW_LENGTH;

  return (
    <aside
      id={id}
      className={`context-sidebar${isOpen ? ' context-sidebar--open' : ''}`}
      aria-label="1:1 context"
      inert={isInert}
    >
      <PrepPrompts memberId={memberId} showReminders={false} />
      <section className="context-sidebar__section" aria-labelledby={`${ids}-reminders`}>
        <h3 id={`${ids}-reminders`} className="context-sidebar__title">
          Reminders
        </h3>
        {due.length === 0 ? (
          <p className="context-sidebar__empty">Nothing set for this 1:1.</p>
        ) : (
          <ReminderStack reminders={due} onDismiss={dismissReminder} onSnooze={snoozeReminder} />
        )}
      </section>
      <section className="context-sidebar__section" aria-labelledby={`${ids}-items`}>
        <h3 id={`${ids}-items`} className="context-sidebar__title">
          Open action items
        </h3>
        {openItems.length === 0 ? (
          <p className="context-sidebar__empty">Nothing open from earlier 1:1s.</p>
        ) : (
          <ul className="context-sidebar__list">
            {openItems.map((item) => (
              <li key={item.id} className="context-sidebar__item">
                <label className="context-sidebar__check">
                  <input
                    type="checkbox"
                    checked={doneIds.has(item.id)}
                    onChange={(event) => toggle(item, event.target.checked)}
                  />
                  <span>{item.title}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="context-sidebar__section" aria-labelledby={`${ids}-last`}>
        <h3 id={`${ids}-last`} className="context-sidebar__title">
          Last meeting notes
        </h3>
        {lastNote === null ? (
          <p className="context-sidebar__empty">No earlier notes yet.</p>
        ) : (
          <>
            <p className="context-sidebar__date">
              <time dateTime={lastNote.createdAt}>{formatNoteDate(lastNote.createdAt)}</time>
            </p>
            <p className="context-sidebar__notes">
              {isExpanded ? lastNote.content : truncate(lastNote.content)}
            </p>
            {canExpand ? (
              <button
                type="button"
                className="context-sidebar__more"
                aria-expanded={isExpanded}
                onClick={() => setIsExpanded((current) => !current)}
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            ) : null}
          </>
        )}
      </section>
      <section className="context-sidebar__section" aria-labelledby={`${ids}-prompts`}>
        <h3 id={`${ids}-prompts`} className="context-sidebar__title">
          Prep prompts
        </h3>
        <ul className="context-sidebar__prompts">
          {prompts.map((prompt) => (
            <li key={prompt}>{prompt}</li>
          ))}
        </ul>
      </section>
      {footer}
    </aside>
  );
}
