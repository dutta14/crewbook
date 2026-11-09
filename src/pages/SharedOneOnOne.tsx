import { useEffect, useRef, type MouseEvent } from 'react';
import { useParams } from 'react-router-dom';
import '../styles/shared-view.css';
import { EyeIcon, ClockIcon } from '../components/icons';
import { useDarkMode } from '../hooks/useDarkMode';
import { useNow } from '../hooks/useNow';
import { useSharedView } from '../hooks/useSharedView';
import type { SharedActionItem, SharedViewPayload } from '../types/sharing';
import { formatNoteDate } from '../utils/noteFormat';
import { isOverdue } from '../utils/scheduleCalculator';
import { formatScheduleDate } from '../utils/scheduleFormat';
import { describeTimeLeft, isExpiringSoon } from '../utils/shareExpiry';
import { ExpiredLink } from './ExpiredLink';

function SharedAvatar({
  name,
  initials,
  color,
}: {
  name: string;
  initials: string;
  color: string;
}) {
  return (
    <span
      className="shared-view__avatar"
      role="img"
      aria-label={name}
      style={{ backgroundColor: color }}
    >
      <span aria-hidden="true">{initials}</span>
    </span>
  );
}

function ActionRow({ item, managerName }: { item: SharedActionItem; managerName: string }) {
  const owner = item.owner === 'engineer' ? 'You' : managerName;
  const due = item.dueDate ? formatScheduleDate(item.dueDate) : null;
  const overdue = item.status === 'open' && item.dueDate !== undefined && isOverdue(item.dueDate);
  const isDone = item.status === 'done';
  return (
    <li className="shared-view__action">
      <input type="checkbox" disabled checked={isDone} aria-label={item.title} />
      <span
        className={`shared-view__action-title${isDone ? ' shared-view__action-title--done' : ''}`}
      >
        {item.title}
      </span>
      <span className="shared-view__owner" aria-label={`Assigned to ${owner}`}>
        {owner}
      </span>
      {due && item.dueDate && (
        <time
          className={`shared-view__due${overdue ? ' shared-view__due--overdue' : ''}`}
          dateTime={item.dueDate}
        >
          Due {due}
          {overdue && <span className="sr-only"> (overdue)</span>}
        </time>
      )}
    </li>
  );
}

function SharedContent({ data }: { data: SharedViewPayload }) {
  const agendaHeading = useRef<HTMLHeadingElement>(null);
  const now = useNow();
  const { managerName, engineerName, engineerAvatar } = data;

  useEffect(() => {
    const previous = document.title;
    document.title = '1:1 Notes';
    return () => {
      document.title = previous;
    };
  }, []);

  const skipToAgenda = (event: MouseEvent<HTMLAnchorElement>) => {
    // The hash belongs to HashRouter, so the anchor must not navigate.
    event.preventDefault();
    agendaHeading.current?.focus();
  };

  return (
    <>
      <a className="skip-link" href="#shared-agenda" onClick={skipToAgenda}>
        Skip to agenda
      </a>
      <main className="shared-view" aria-label={`1:1 shared view with ${managerName}`}>
        <header className="shared-view__header">
          <h1 className="shared-view__title">1:1 with {managerName}</h1>
          <div className="shared-view__person">
            <SharedAvatar name={engineerName} {...engineerAvatar} />
            <span className="shared-view__name">{engineerName}</span>
          </div>
          <p
            className={`shared-view__expiry${isExpiringSoon(data.expiresAt, now) ? ' shared-view__expiry--soon' : ''}`}
          >
            <ClockIcon size={14} />
            <time dateTime={data.expiresAt}>
              Expires in {describeTimeLeft(data.expiresAt, now)}
            </time>
          </p>
        </header>

        <section className="shared-view__section" aria-labelledby="shared-notes-title">
          <h2 id="shared-notes-title" className="shared-view__section-title">
            <EyeIcon size={16} />
            Shared notes
          </h2>
          {data.sharedNotes.length === 0 ? (
            <p className="shared-view__empty">No shared notes yet.</p>
          ) : (
            <ul className="shared-view__list" aria-label="Shared notes">
              {data.sharedNotes.map((note) => (
                <li key={note.id} className="shared-view__card">
                  <p className="shared-view__note">{note.text}</p>
                  <time className="shared-view__time" dateTime={note.createdAt}>
                    {formatNoteDate(note.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="shared-view__section" aria-labelledby="shared-actions-title">
          <h2 id="shared-actions-title" className="shared-view__section-title">
            Action items
          </h2>
          {data.actionItems.length === 0 ? (
            <p className="shared-view__empty">No action items yet.</p>
          ) : (
            <ul className="shared-view__list shared-view__list--tight" aria-label="Action items">
              {data.actionItems.map((item) => (
                <ActionRow key={item.id} item={item} managerName={managerName} />
              ))}
            </ul>
          )}
        </section>

        <section className="shared-view__section" aria-labelledby="shared-agenda">
          <h2
            id="shared-agenda"
            ref={agendaHeading}
            tabIndex={-1}
            className="shared-view__section-title"
          >
            Agenda
          </h2>
          <p className="shared-view__time">
            Agenda items as of{' '}
            <time dateTime={data.createdAt}>{formatNoteDate(data.createdAt)}</time>. This page is a
            snapshot and cannot be edited.
          </p>
          {data.agendaItems.length === 0 ? (
            <p className="shared-view__empty">No agenda items yet.</p>
          ) : (
            <ul className="shared-view__list" aria-label="Agenda items">
              {data.agendaItems.map((item) => (
                <li key={item.id} className="shared-view__card">
                  <p className="shared-view__note">{item.text}</p>
                  <p className="shared-view__time">
                    Added by {item.addedBy === 'engineer' ? 'you' : managerName} ·{' '}
                    <time dateTime={item.createdAt}>{formatNoteDate(item.createdAt)}</time>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

/** The recipient's page: reads everything from the link, never from this browser's storage. */
export function SharedOneOnOne() {
  const { token } = useParams<{ token?: string }>();
  const { status, data } = useSharedView(token);
  useDarkMode();

  if (status === 'loading') {
    return (
      <main className="shared-view" aria-busy="true" aria-label="Loading shared 1:1">
        <p className="shared-view__empty">Loading…</p>
      </main>
    );
  }
  if (status !== 'valid' || data === null) {
    return <ExpiredLink reason={status === 'expired' ? 'expired' : 'invalid'} />;
  }
  return <SharedContent data={data} />;
}
