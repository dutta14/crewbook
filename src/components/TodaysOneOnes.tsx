import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAll } from '../data/actionItems';
import { listNotes } from '../data/notes';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import type { TeamMember } from '../types/TeamMember';
import {
  getNextUpcoming,
  getTodaysOneOnes,
  type DigestContext,
  type TodayEntry,
} from '../utils/scheduleCalculator';
import { formatLastMet, formatTime, formatUpcomingDay } from '../utils/scheduleFormat';
import '../styles/todays-one-ones.css';
import { Avatar } from './Avatar';

interface TodaysOneOnesProps {
  members: TeamMember[];
  /** Fixed clock for tests; defaults to the current time. */
  now?: Date;
}

const HEADING_ID = 'todays-one-ones-heading';
const LOAD_FAILED = "Couldn't open today's 1:1s. Lock and unlock Crewbook to try again.";

/** Names, times and counts are derived on render and never stored, titled or put in the URL. */
export function TodaysOneOnes({ members, now }: TodaysOneOnesProps) {
  const storage = useEncryptedStorage();
  const { isPrivateUnlocked, loadPrivate } = storage;
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    loadPrivate().catch(() => {
      if (isCurrent) setLoadFailed(true);
    });
    return () => {
      isCurrent = false;
    };
  }, [loadPrivate]);

  const { entries, next } = useMemo(() => {
    const clock = now ?? new Date();
    if (!isPrivateUnlocked) return { entries: [], next: null };
    const openActionItems = new Map<string, number>();
    for (const item of listAll(storage, 'open')) {
      openActionItems.set(item.memberId, (openActionItems.get(item.memberId) ?? 0) + 1);
    }
    const lastMetDates = new Map<string, string>();
    for (const member of members) {
      const [latest] = listNotes(member.id, storage);
      if (latest) lastMetDates.set(member.id, latest.createdAt);
    }
    const context: DigestContext = { openActionItems, lastMetDates, now: clock };
    const todays = getTodaysOneOnes(members, context);
    return { entries: todays, next: todays.length === 0 ? getNextUpcoming(members, clock) : null };
  }, [isPrivateUnlocked, members, now, storage]);

  const upcomingDay = next ? formatUpcomingDay(next.date, now) : null;

  return (
    <section className="todays-card" aria-labelledby={HEADING_ID}>
      <h3 id={HEADING_ID} className="todays-card__heading">
        Today&apos;s 1:1s
      </h3>
      {loadFailed ? (
        <p className="form-error" role="alert">
          {LOAD_FAILED}
        </p>
      ) : !isPrivateUnlocked ? (
        <p className="todays-card__status">Opening today&apos;s 1:1s…</p>
      ) : entries.length === 0 ? (
        <div className="todays-card__empty">
          <p className="todays-card__empty-title">No 1:1s scheduled today</p>
          {next && upcomingDay ? (
            <p className="todays-card__empty-next">
              Next: {next.name} on {upcomingDay}
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="todays-card__list">
          {entries.map((entry, index) => (
            <DigestRow
              key={entry.memberId}
              entry={entry}
              member={members.find((member) => member.id === entry.memberId)}
              index={index}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface DigestRowProps {
  entry: TodayEntry;
  member: TeamMember | undefined;
  index: number;
}

const MAX_STAGGERED_ROWS = 10;

function DigestRow({ entry, member, index }: DigestRowProps) {
  const lastMet = entry.lastMetDate ? formatLastMet(entry.lastMetDate) : null;
  const count = entry.openActionItems;
  return (
    <li
      className="digest-item"
      style={{ animationDelay: `${Math.min(index, MAX_STAGGERED_ROWS) * 40}ms` }}
    >
      <Link className="digest-row" to={`/person/${entry.memberId}`}>
        <span className="digest-row__who">
          <Avatar name={entry.name} avatarUrl={member?.avatarUrl} size="sm" aria-hidden />
          <span className="digest-row__name">{entry.name}</span>
          <span className="digest-row__time">{formatTime(entry.time)}</span>
        </span>
        <span className="digest-row__meta">
          {count > 0 ? (
            <span
              className="digest-row__pill"
              role="img"
              aria-label={`${count} open action ${count === 1 ? 'item' : 'items'}`}
            >
              {count}
            </span>
          ) : null}
          <span className="digest-row__last-met">
            {lastMet ? (
              <>
                Last met <time dateTime={lastMet.dateTime}>{lastMet.label}</time>
              </>
            ) : (
              'Not met yet'
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
