import { useMemo, useState, type ReactNode } from 'react';
import { MANAGER_OWNER_ID } from '../data/actionItems';
import { isDecisionFollowUpFilter } from '../data/decisions';
import type {
  Decision,
  DecisionFollowUpFilter,
  FollowUp,
  FollowUpStatus,
} from '../types/decisions';
import type { TeamMember } from '../types/TeamMember';
import '../styles/decisions.css';
import { DecisionCard } from './DecisionCard';
import { EmptyState } from './EmptyState';
import { FilterChips } from './FilterChips';
import { FollowUpCard } from './FollowUpCard';
import { GavelIcon } from './icons';

interface DecisionFollowUpListProps {
  decisions: Decision[];
  followUps: FollowUp[];
  /** Used for each entry's person and each follow-up owner's current name and avatar. */
  members: TeamMember[];
  /** The notes that still exist, so a link to a missing one can say so. */
  meetingIds: ReadonlySet<string>;
  onStatusChange: (id: string, next: FollowUpStatus) => Promise<void> | void;
  /** Names the person on every card, for lists that span the team. */
  showPerson?: boolean;
  /** Extra controls to the right of the filter bar. */
  toolbar?: ReactNode;
  now?: Date;
}

type Entry =
  | { kind: 'decision'; id: string; createdAt: string; decision: Decision }
  | { kind: 'follow-up'; id: string; createdAt: string; followUp: FollowUp };

export const FILTER_OPTIONS: Array<{ value: DecisionFollowUpFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'decisions', label: 'Decisions' },
  { value: 'follow-ups', label: 'Follow-ups' },
];

export const EMPTY_TITLE = 'No decisions or follow-ups yet';
export const EMPTY_DESCRIPTION = 'Capture them during your next 1:1';

function describeCount(filter: DecisionFollowUpFilter, count: number): string {
  const noun =
    filter === 'decisions' ? 'decision' : filter === 'follow-ups' ? 'follow-up' : 'entry';
  const plural = noun === 'entry' ? 'entries' : `${noun}s`;
  return `Showing ${count} ${count === 1 ? noun : plural}`;
}

/**
 * Decisions and follow-ups together, newest first, with a filter for either kind. The filter is
 * component state only; it never reaches the URL or storage.
 */
export function DecisionFollowUpList({
  decisions,
  followUps,
  members,
  meetingIds,
  onStatusChange,
  showPerson = false,
  toolbar,
  now,
}: DecisionFollowUpListProps) {
  const [filter, setFilter] = useState<DecisionFollowUpFilter>('all');
  const people = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const entries = useMemo(() => {
    const merged: Entry[] = [
      ...(filter === 'follow-ups'
        ? []
        : decisions.map((decision): Entry => ({
            kind: 'decision',
            id: decision.id,
            createdAt: decision.createdAt,
            decision,
          }))),
      ...(filter === 'decisions'
        ? []
        : followUps.map((followUp): Entry => ({
            kind: 'follow-up',
            id: followUp.id,
            createdAt: followUp.createdAt,
            followUp,
          }))),
    ];
    return merged
      .map((entry, index) => ({ entry, index }))
      .sort(
        (a, b) =>
          Date.parse(b.entry.createdAt) - Date.parse(a.entry.createdAt) || a.index - b.index,
      )
      .map(({ entry }) => entry);
  }, [decisions, followUps, filter]);

  const personName = (engineerId: string) =>
    showPerson ? people.get(engineerId)?.name : undefined;

  return (
    <div className="decision-list">
      <div className="decision-list__controls">
        <FilterChips
          ariaLabel="Filter by type"
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(value) => {
            if (isDecisionFollowUpFilter(value)) setFilter(value);
          }}
        />
        {toolbar}
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {describeCount(filter, entries.length)}
      </div>
      {entries.length === 0 ? (
        <EmptyState
          icon={<GavelIcon size={48} />}
          title={EMPTY_TITLE}
          description={EMPTY_DESCRIPTION}
        />
      ) : (
        <ul className="decision-list__items" aria-label="Decisions and follow-ups">
          {entries.map((entry) => (
            <li key={`${entry.kind}-${entry.id}`}>
              {entry.kind === 'decision' ? (
                <DecisionCard
                  decision={entry.decision}
                  personName={personName(entry.decision.engineerId)}
                  isMeetingAvailable={meetingIds.has(entry.decision.linkedMeetingId)}
                />
              ) : (
                <FollowUpCard
                  followUp={entry.followUp}
                  ownerName={
                    entry.followUp.ownerId === MANAGER_OWNER_ID
                      ? undefined
                      : people.get(entry.followUp.ownerId)?.name
                  }
                  ownerAvatarUrl={people.get(entry.followUp.ownerId)?.avatarUrl}
                  personName={personName(entry.followUp.engineerId)}
                  isMeetingAvailable={meetingIds.has(entry.followUp.linkedMeetingId)}
                  onStatusChange={onStatusChange}
                  now={now}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
